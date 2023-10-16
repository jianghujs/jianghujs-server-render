'use strict';
const Service = require('egg').Service;
const {tableEnum, articlePublishStatusEnum} = require("../constant/constant");
const _ = require("lodash");
const path = require("path");

// TODO: 封装一下
const dayjs = require("dayjs");
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone') // dependent on utc plugin
dayjs.extend(utc)
dayjs.extend(timezone)

const idGenerateUtil = require("@jianghujs/jianghu/app/common/idGenerateUtil");
const validateUtil = require("@jianghujs/jianghu/app/common/validateUtil");
const fileUtil = require('@jianghujs/jianghu/app/common/fileUtil');
const {BizError, errorInfoEnum} = require("../constant/error");
const fs = require("fs"),
  nodePath = require("path"),
  fsPromises = require("fs").promises,
  unlink = fsPromises.unlink,
  rename = fsPromises.rename,
  lstat = fsPromises.lstat,
  util = require("util"),
  rimraf = util.promisify(require("rimraf")),
  exists = util.promisify(fs.exists),
  copyFile = util.promisify(fs.copyFile);

const actionDataScheme = Object.freeze({
  deletedArticle: {
    type: "object",
    additionalProperties: true,
    required: ["articleId"],
    properties: {
      articleId: {anyOf: [{type: "string"}, {type: "number"}]},
    },
  },
  restoreArticle: {
    type: "object",
    additionalProperties: true,
    required: ["articleId"],
    properties: {
      articleId: {anyOf: [{type: "string"}, {type: "number"}]},
    },
  },
  useMaterial: {
    type: "object",
    additionalProperties: true,
    required: ["path", "articleId"],
    properties: {
        path: { anyOf: [{ type: "string" }, { type: "number" }] },
        articleId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },
});

function pathCheck (path) {
  if (path.indexOf("../") > -1) {
      throw new BizError(errorInfoEnum.path_invalid);
  }
  if (path.endsWith("..")) {
      throw new BizError(errorInfoEnum.path_invalid);
  }
}
class ArticleService extends Service {

  async fillInsertItemParamsBeforeHook() {
    const {userId, username} = this.ctx.userInfo;
    const time = dayjs().format();
    const tableName = "article";
    const columnName = "articleId";
    const articleId = await idGenerateUtil.idPlus({
      knex: this.app.jianghuKnex,
      tableName,
      columnName,
    });
    // 浏览器传过来的时间 要转成 Asia/Shanghai；
    let {articlePublishTime} = this.ctx.request.body.appData.actionData;
    if (articlePublishTime) {
      articlePublishTime = dayjs(articlePublishTime).tz("Asia/Shanghai").format();
    }
    if (!dayjs(articlePublishTime).isValid()) {
      articlePublishTime = dayjs().tz("Asia/Shanghai").format();
    }
    Object.assign(this.ctx.request.body.appData.actionData, {
      articleId,
      articlePublishTime,
      articleCreateTime: time,
      articleCreateUserId: userId,
      articleCreateUsername: username,
      articleUpdateTime: time,
      articleUpdateUserId: userId,
      articleUpdateUsername: username,
    })
  }

  async fillUpdateItemParamsBeforeHook() {
    const {userId, username} = this.ctx.userInfo;
    const time = dayjs().format();
    // 浏览器传过来的时间 要转成 Asia/Shanghai；
    let {articlePublishTime} = this.ctx.request.body.appData.actionData;
    if (articlePublishTime) {
      articlePublishTime = dayjs(articlePublishTime).tz("Asia/Shanghai").format();
    }
    if (!dayjs(articlePublishTime).isValid()) {
      articlePublishTime = dayjs().tz("Asia/Shanghai").format();
    }
    Object.assign(this.ctx.request.body.appData.actionData, {
      articlePublishTime,
      articleUpdateTime: time,
      articleUpdateUserId: userId,
      articleUpdateUsername: username,
    })
  }

  async deletedArticle() {
    const {jianghuKnex} = this.app;
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.deletedArticle, actionData);
    const {articleId} = actionData;
    const {articleMaterialDir} = this.app.config;

    await jianghuKnex(tableEnum.article, this.ctx).where({articleId}).update({articlePublishStatus: articlePublishStatusEnum.deleted});

    const articleDirPath = path.join(articleMaterialDir, `${articleId}`);
    const articleRecycleDirPath = path.join(articleMaterialDir, '_recycle', `${articleId}`);
    if (!await exists(articleDirPath)) {
      return;
    }
    if (await exists(articleRecycleDirPath)) {
      await rimraf(articleRecycleDirPath);
    }
    await rename(articleDirPath, articleRecycleDirPath)
  }

  async restoreArticle() {
    const {jianghuKnex} = this.app;
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.restoreArticle, actionData);
    const {articleId} = actionData;
    const {articleMaterialDir} = this.app.config;

    await jianghuKnex(tableEnum.article, this.ctx).where({articleId}).update({articlePublishStatus: articlePublishStatusEnum.login});

    const articleDirPath = path.join(articleMaterialDir, `${articleId}`);
    const articleRecycleDirPath = path.join(articleMaterialDir, '_recycle', `${articleId}`);
    if (!await exists(articleRecycleDirPath) || await exists(articleDirPath)) {
      return;
    }
    await rename(articleRecycleDirPath, articleDirPath);
  }

  async getArticleAndFillArticles() {
    const {ctx, app} = this;
    const {jianghuKnex} = app;
    const articleId = ctx.pathParams && ctx.pathParams[0]
      || this.ctx.request.body.appData.actionData.articleId;
    const article = await jianghuKnex(tableEnum.article)
      .where({articleId})
      .first();
    if (!article) {
      throw new BizError(errorInfoEnum.article_not_found)
    }

    const {categoryId} = article;
    let articlelist = await jianghuKnex(tableEnum.view01_article)
      .where({
        categoryId,
      })
      .select();
    articlelist = articlelist.map(
      ({
         articleId,
         articleTitle,
         categoryId,
         categoryName,
         articleCoverImage,
         articlePublishStatus,
         articleGroupName,
       }) => {
        return {
          articleId,
          articleTitle,
          categoryId,
          categoryName,
          articleCoverImage,
          articlePublishStatus,
          articleGroupName,
        };
      }
    );
    const groupNameArticlelist = articlelist.filter(({articleGroupName}) => !!articleGroupName);
    const noGroupNameArticlelist = articlelist.filter(
      ({articleGroupName}) => !articleGroupName
    );
    const groupByArticleMap = _.groupBy(groupNameArticlelist, "articleGroupName");
    const hasGroupNameArticlelist = Object.values(groupByArticleMap).map(list => {
      const {articleGroupName} = list[0];
      return {
        articleTitle: articleGroupName,
        isGroup: true,
        childrenList: list,
      };
    });
    let newArticleList = hasGroupNameArticlelist.concat(noGroupNameArticlelist);
    newArticleList = _.orderBy(
      newArticleList,
      ["articleTitle"],
      ["asc"]
    );
    article.articleList = newArticleList;
    this.ctx.seo = this.ctx.seo || {}
    this.ctx.seo.article = article;
    return article;
  }

  async getCategoryListAndArticleList() {
    const {ctx, app} = this;
    const {jianghuKnex} = app;

    let categoryList = await jianghuKnex(tableEnum.view01_category).select('categoryId', 'categoryName');
    if (categoryList && categoryList.length) {
      for (const category of categoryList) {
        const categoryId = category.categoryId;
        category['articleList'] = await jianghuKnex(tableEnum.view01_article).where({categoryId}).select('articleId', 'articleTitle');
        if(category['articleList'].length > 5) {
          category['articleList'] = category['articleList'].slice(0, 5);
        }
      }
      categoryList = categoryList.filter(category => category['articleList'].length)
    }

    return categoryList;

  }

  async useMaterial() {
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.useMaterial, actionData);
    const { cloudDriveDir, articleMaterialDir } = this.app.config;
    const { path, articleId } = actionData;
    pathCheck(path);
    const targetPath = nodePath.join(cloudDriveDir, path);
    const stat = await lstat(targetPath);
    const isFile = stat.isFile();
    if (!isFile) {
        throw new BizError(errorInfoEnum.material_is_not_file);
    }

    const filename = path.substring(path.lastIndexOf('/')+1);
    const filenameStorage = `${Date.now()}_${filename}`;
    const fileStoragePath = nodePath.join(articleMaterialDir, `${articleId}`);
    const isFileStorageExists = await exists(fileStoragePath);
    if (!isFileStorageExists) {
        await fileUtil.checkAndPrepareFilePath(fileStoragePath);
    }

    const articleMaterialPath = nodePath.join(articleMaterialDir, `${articleId}`, filenameStorage);
    await copyFile(targetPath, articleMaterialPath);
    const downloadPath = nodePath.join('/articleMaterial', `${articleId}`, filenameStorage);
    return { filename, downloadPath };
  }

}

module.exports = ArticleService;
