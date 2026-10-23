import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
    testDir: './tests/Browser',
    timeout: 45000,
    expect: { timeout: 12000 },
    workers: 1,
    reporter: [
        ['list'],
        [
            'html',
            {
                open: 'never',
                outputFolder: 'storage/test-results/browser-report',
            },
        ],
    ],
    outputDir: 'storage/test-results/browser',
    use: {
        baseURL: 'http://127.0.0.1:8123',
        channel: 'chrome',
        headless: true,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
    },
    webServer: {
        stderr: 'ignore',
        stdout: 'ignore',
        command:
            'php tests/Support/prepare-browser.php && php -S 127.0.0.1:8123 -t public',
        url: 'http://127.0.0.1:8123/login',
        reuseExistingServer: false,
        env: {
            APP_ENV: 'local',
            WORKSPACE_BROWSER_TEST: '1',
            APP_URL: 'http://127.0.0.1:8123',
            DB_DATABASE: path.resolve('storage/framework/browser.sqlite'),
            WORKSPACE_REGISTRATION_ENABLED: 'true',
            WORKSPACE_REGISTRATION_CODE: 'browser-test-code-32-characters-only',
            MAIL_MAILER: 'log',
            SESSION_SECURE_COOKIE: 'false',
        },
    },
});
