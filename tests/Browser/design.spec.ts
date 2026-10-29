import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const registry = JSON.parse(
    readFileSync(
        new URL('../../docs/themes/lightomatic.registry.json', import.meta.url),
        'utf8',
    ),
) as { cssVars: Record<'light' | 'dark', Record<string, string>> };

for (const mode of ['light', 'dark'] as const) {
    test(`design: ${mode}, desktop and mobile`, async ({ page }) => {
        test.setTimeout(90000);
        const externalFonts: string[] = [];
        page.on('request', (request) => {
            if (
                request.resourceType() === 'font' &&
                new URL(request.url()).hostname !== '127.0.0.1'
            )
                externalFonts.push(request.url());
        });
        await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto('/register');
        await expect(
            page.getByRole('heading', { name: 'Konto erstellen', exact: true }),
        ).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
            animations: 'disabled',
            path: `storage/test-results/design-${mode}-register.png`,
        });
        await page.setViewportSize({ width: 390, height: 1000 });
        await page.screenshot({
            animations: 'disabled',
            path: `storage/test-results/design-${mode}-390-register.png`,
        });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto('/login');
        const themeCheck = await page.evaluate(
            async (tokens) => {
                const probe = document.createElement('span');
                document.body.append(probe);
                const mismatches: string[] = [];
                for (const [name, expected] of Object.entries(tokens)) {
                    if (!expected.startsWith('oklch(')) continue;
                    probe.style.color = `var(--${name})`;
                    const actual = getComputedStyle(probe).color;
                    probe.style.color = expected;
                    const reference = getComputedStyle(probe).color;
                    const channels = (color: string) =>
                        color.match(/[-+]?\d*\.?\d+/g)?.map(Number) ?? [];
                    const a = channels(actual);
                    const b = channels(reference);
                    if (
                        actual.split('(')[0] !== reference.split('(')[0] ||
                        a.length !== b.length ||
                        a.some(
                            (channel, index) =>
                                Math.abs(channel - b[index]) > 0.001,
                        )
                    )
                        mismatches.push(name);
                }
                probe.style.boxShadow = 'var(--shadow-md)';
                const actualShadow = getComputedStyle(probe).boxShadow;
                probe.style.boxShadow = tokens['shadow-md'];
                if (actualShadow !== getComputedStyle(probe).boxShadow)
                    mismatches.push('shadow-md');
                probe.remove();
                const fonts = await Promise.all(
                    [
                        '16px Outfit',
                        '16px "Playfair Display"',
                        '16px "Space Mono"',
                    ].map((font) => document.fonts.load(font)),
                );
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 1;
                const context = canvas.getContext('2d');
                if (!context) throw new Error('Canvas unavailable');
                const luminance = (token: string) => {
                    context.fillStyle = getComputedStyle(
                        document.documentElement,
                    )
                        .getPropertyValue(`--${token}`)
                        .trim();
                    context.fillRect(0, 0, 1, 1);
                    const rgb = Array.from(
                        context.getImageData(0, 0, 1, 1).data,
                    )
                        .slice(0, 3)
                        .map((value) => {
                            const channel = value / 255;
                            return channel <= 0.04045
                                ? channel / 12.92
                                : ((channel + 0.055) / 1.055) ** 2.4;
                        });
                    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
                };
                const contrasts = Object.fromEntries(
                    [
                        'background',
                        'card',
                        'primary',
                        'secondary',
                        'accent',
                        'sidebar-accent',
                    ].map((background) => {
                        const a = luminance(background);
                        const b = luminance(
                            background === 'background'
                                ? 'foreground'
                                : `${background}-foreground`,
                        );
                        return [
                            background,
                            Math.round(
                                ((Math.max(a, b) + 0.05) /
                                    (Math.min(a, b) + 0.05)) *
                                    100,
                            ) / 100,
                        ];
                    }),
                );
                return {
                    contrasts,
                    mismatches,
                    fontsLoaded: fonts.every(
                        (faces) =>
                            faces.length > 0 &&
                            faces.every((face) => face.status === 'loaded'),
                    ),
                    family: getComputedStyle(document.body).fontFamily,
                    radius: getComputedStyle(document.documentElement)
                        .getPropertyValue('--radius')
                        .trim(),
                    spacing: getComputedStyle(document.body).letterSpacing,
                };
            },
            {
                ...registry.cssVars[mode],
                'secondary-foreground': registry.cssVars.dark.background,
                'sidebar-accent-foreground': registry.cssVars.dark.background,
                ...(mode === 'light'
                    ? { 'accent-foreground': registry.cssVars.dark.background }
                    : {}),
            },
        );
        expect(themeCheck.mismatches).toEqual([]);
        expect(themeCheck.fontsLoaded).toBe(true);
        expect(themeCheck.family).toContain('Outfit');
        expect(parseFloat(themeCheck.radius)).toBe(0.25);
        expect(themeCheck.radius.endsWith('rem')).toBe(true);
        expect(['normal', '0px']).toContain(themeCheck.spacing);
        console.log(
            `${mode} Lightomatic contrast ratios`,
            themeCheck.contrasts,
        );
        for (const contrast of Object.values(themeCheck.contrasts))
            expect(contrast).toBeGreaterThanOrEqual(4.5);
        await page.screenshot({
            animations: 'disabled',
            path: `storage/test-results/design-${mode}-login.png`,
        });
        await page.setViewportSize({ width: 390, height: 1000 });
        await page.screenshot({
            animations: 'disabled',
            path: `storage/test-results/design-${mode}-390-login.png`,
        });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.locator('input[name=email]').fill('britta@example.test');
        await page.locator('input[name=password]').fill('Browser-test-123!');
        await page.locator('button[type=submit]').click();
        await expect(
            page.getByRole('heading', { name: 'Schreibtisch', exact: true }),
        ).toBeVisible();
        await expect(page.locator('html')).toHaveClass(
            mode === 'dark' ? /dark/ : /^(?!.*dark).*$/,
        );

        const taskTitle = `Darstellungsprobe ${mode}`;
        const today = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Europe/Berlin',
        }).format(new Date());
        for (const [suffix, offset] of [
            ['', null],
            [' – heute', 0],
            [' – überfällig', -1],
            [' – demnächst', 3],
        ] as const) {
            const title = taskTitle + suffix;
            await page.getByLabel('Neue Aufgabe', { exact: true }).fill(title);
            await page
                .getByLabel('Neue Aufgabe', { exact: true })
                .press('Enter');
            await expect(
                page.getByRole('button', {
                    name: `Details: ${title}`,
                    exact: true,
                }),
            ).toBeEnabled();
            const row = page.locator('.task-row').filter({
                has: page.locator(
                    `input[aria-label="Aufgabentitel"][value="${title}"]`,
                ),
            });
            if (offset !== null) {
                const due = new Date(`${today}T12:00:00Z`);
                due.setUTCDate(due.getUTCDate() + offset);
                await row
                    .getByLabel('Frist', { exact: true })
                    .fill(due.toISOString().slice(0, 10));
            }
            if (offset === 0) {
                await row
                    .getByLabel('Zuständig', { exact: true })
                    .selectOption({ label: 'Britta' });
                await row
                    .getByLabel('Projekt zuordnen', { exact: true })
                    .selectOption({ label: 'Noch nicht terminiert' });
            }
            await expect(row.locator('.sync-state')).toHaveCount(0);
        }
        await page.reload();
        await expect(
            page.getByRole('button', {
                name: `Details: ${taskTitle}`,
                exact: true,
            }),
        ).toBeEnabled();
        let currentView = 'Schreibtisch';
        for (const width of [1440, 820, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            for (const view of [
                'Schreibtisch',
                'Projekte',
                'Kalender',
                'Wochencheck',
                'Jahresplan',
                'Papierkorb',
            ]) {
                if (width === 390)
                    await page
                        .getByRole('button', { name: 'Navigation umschalten' })
                        .click();
                const loaded =
                    view === currentView
                        ? null
                        : page.waitForResponse((response) => {
                              const url = new URL(response.url());
                              return (
                                  url.pathname === '/api/workspace/tasks' &&
                                  !url.searchParams.has('from') &&
                                  url.searchParams.get('check') ===
                                      (view === 'Wochencheck'
                                          ? 'overdue'
                                          : null) &&
                                  response.status() === 200
                              );
                          });
                await page
                    .getByRole('button', { name: view, exact: true })
                    .click();
                if (loaded) await loaded;
                currentView = view;
                await page.evaluate(() => window.scrollTo(0, 0));
                await expect(
                    page.getByRole('heading', { name: view, exact: true }),
                ).toBeVisible();
                if (view === 'Jahresplan') {
                    await expect
                        .poll(() =>
                            page
                                .locator('.year-table th')
                                .first()
                                .evaluate(
                                    (element) =>
                                        element.scrollWidth <=
                                        element.clientWidth + 1,
                                ),
                        )
                        .toBe(true);
                }
                await expect
                    .poll(() =>
                        page.evaluate(
                            () =>
                                document.documentElement.scrollWidth <=
                                innerWidth,
                        ),
                    )
                    .toBe(true);
                await page.screenshot({
                    animations: 'disabled',
                    path: `storage/test-results/design-${mode}-${width}-${view}.png`,
                    fullPage: view === 'Schreibtisch',
                });
                if (view === 'Kalender') {
                    await page
                        .getByLabel('Kalenderansicht')
                        .selectOption('week');
                    await expect(
                        page.getByRole('heading', { name: /^Woche / }),
                    ).toBeVisible();
                    await expect
                        .poll(() =>
                            page.evaluate(
                                () =>
                                    document.documentElement.scrollWidth <=
                                    innerWidth,
                            ),
                        )
                        .toBe(true);
                    await page.screenshot({
                        animations: 'disabled',
                        path: `storage/test-results/design-${mode}-${width}-Woche.png`,
                    });
                    await page
                        .getByLabel('Kalenderansicht')
                        .selectOption('month');
                }
            }
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page
            .getByRole('button', { name: 'Schreibtisch', exact: true })
            .click();
        await page
            .getByRole('button', { name: `Details: ${taskTitle}`, exact: true })
            .click();
        const sheet = page.locator('[data-slot=sheet-content]');
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            await expect(sheet).toBeVisible();
            await expect
                .poll(() =>
                    sheet.evaluate(
                        (element) =>
                            element.scrollWidth <= element.clientWidth + 1,
                    ),
                )
                .toBe(true);
            await page.screenshot({
                animations: 'disabled',
                path: `storage/test-results/design-${mode}-${width}-Details.png`,
            });
        }
        await page.keyboard.press('Escape');
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            for (const route of ['profile', 'password', 'appearance']) {
                await page.goto(`/settings/${route}`);
                await expect(page).toHaveURL(new RegExp(`/settings/${route}$`));
                await page.evaluate(() => document.fonts.ready);
                await page.screenshot({
                    animations: 'disabled',
                    path: `storage/test-results/design-${mode}-${width}-settings-${route}.png`,
                });
            }
        }
        expect(externalFonts).toEqual([]);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto('/reports/year/2026/print');
        await page.emulateMedia({ media: 'print' });
        await expect(page.locator('html')).not.toHaveClass(/dark/);
        await expect(page.locator('body')).toHaveCSS('box-shadow', 'none');
        await page.screenshot({
            animations: 'disabled',
            path: `storage/test-results/design-${mode}-print.png`,
            fullPage: true,
        });
    });
}
