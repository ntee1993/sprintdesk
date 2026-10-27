import { AppService } from './app.service.js';

describe('AppService', () => {
  const appService = new AppService();

  describe('health', () => {
    it('should return { status: "ok" }', () => {
      expect(appService.getHealth()).toEqual({ status: 'ok' });
    });
  });
});
