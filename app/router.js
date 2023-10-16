'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {

  const { router, controller, config } = app;

  router.get('/', controller.seo.index);

};

