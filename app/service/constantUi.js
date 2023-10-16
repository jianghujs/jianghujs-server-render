'use strict';

// ========================================常用 require start===========================================
const Service = require('egg').Service;
const { tableEnum } = require('../constant/constant');
// ========================================常用 require end=============================================


class ConstantUiService extends Service {

  async getConstantUiMap() {
    const { jianghuKnex } = this.app;
    const { pageId } = this.ctx.packagePage;
    const { language } = this.app.config;
    const constantUiList = await jianghuKnex(tableEnum._constant_ui).whereIn('pageId', ['all', pageId]).select();
    const constantUiMap = Object.fromEntries(
      constantUiList.map(obj => [obj.constantKey, JSON.parse(obj[language] || '{}')])
    );
    this.ctx.seo = this.ctx.seo || {}
    this.ctx.seo.constantUiMap = constantUiMap;
    return constantUiMap;
  }
}

module.exports = ConstantUiService;
