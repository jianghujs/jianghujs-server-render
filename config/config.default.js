'use strict';

const path = require('path');

const { middleware, middlewareMatch } = require('@jianghujs/jianghu/config/middlewareConfig');

const eggJianghuDirResolve = require.resolve('@jianghujs/jianghu');
const eggJianghuDir = path.join(eggJianghuDirResolve, '../');

module.exports = appInfo => {

  const appId = 'jianghujs-server-render';
  const uploadDir = path.join(appInfo.baseDir, "upload");

  return {
    appId,
    appTitle: '服务端渲染',
    appLogo: `${appId}/public/img/logo.svg`,
    language: 'zh',

    indexPage: `/${appId}/page/home`,
    loginPage: `/${appId}/page/login`,
    helpPage: `/${appId}/page/help`,

    uploadDir,
    uploadDirConfig: [
      "/articleMaterial",
      "/articleMaterial/_recycle",
      "/materialRepo",
      "/materialRepo/_recycle",
      "/materialRepo/attachment",
      "/materialRepo/image",
      "/materialRepo/audio",
      "/materialRepo/video",
    ],
    downloadBasePath: `/${appId}/upload`,
    articleMaterialDir: path.join(uploadDir, "articleMaterial"),
    cloudDriveDir: path.join(uploadDir, ""),

    primaryColor: "#4caf50",
    primaryColorA80: "#EEF7EE",
    
    static: {
      dynamic: true,
      preload: false,
      maxAge: 31536000,
      buffer: true,
      dir: [
        { prefix: `/${appId}/public/`, dir: path.join(appInfo.baseDir, 'app/public') },
        { prefix: `/${appId}/public/`, dir: path.join(eggJianghuDir, 'app/public') },
      ],
    },
    jianghuConfig: {
      enableUploadStaticFileCache: true,
      enableUploadStaticFileAuthorization: false,
    },

    view: {
      defaultViewEngine: 'nunjucks',
      mapping: { '.html': 'nunjucks' },
      root: [
        path.join(appInfo.baseDir, 'app/view'),
        path.join(eggJianghuDir, 'app/view'),
      ].join(','),
    },

    middleware,
    ...middlewareMatch,

    // 覆盖 downloadUserInfo，适配 /upload/ 开头的路由
    downloadUserInfo: {
      match(ctx) {
        // url 格式符合 /appId/upload
        return (ctx.request.method === 'GET' || ctx.request.method === 'HEAD')
          && (
            ctx.request.path.startsWith(`/${ctx.app.config.appId}/upload/`)
            || ctx.request.path.startsWith(`/upload/`));
      },
    },
  };
  
};
