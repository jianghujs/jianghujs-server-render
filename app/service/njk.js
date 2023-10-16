'use strict';

// ========================================常用 require start===========================================
const Service = require('egg').Service;
// ========================================常用 require end=============================================


class NjkService extends Service {

  async test() {
    this.ctx.seo = this.ctx.seo || {}
    this.ctx.seo.article = {
      string: '服务端渲染 Demo',
    };
  }
}

module.exports = NjkService;
