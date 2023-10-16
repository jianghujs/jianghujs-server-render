'use strict';

const Controller = require('egg').Controller;

class MingdingController extends Controller {

    async index() {
        const app = this.app;
        const { jianghuKnex } = app;

        // ?p=10000 -> /appId/article/10000
        const { p: articleId = 10000 } = this.ctx.query;

        const configs = {};
        // 设置 pathParams、packagePage，在 service.article.getArticleAndFillArticles 中调用
        this.ctx.pathParams = [articleId]
        const page = await jianghuKnex('_page').where({ pageId: 'article' }).first();
        this.ctx.packagePage = page
        configs.article = await this.service.article.getArticleAndFillArticles();
        // 获取 constantUiMap
        configs.constantUiMap = await this.service.constantUi.getConstantUiMap();

        await this.ctx.render(`page/article.html`, configs);
    }
}

module.exports = MingdingController;
