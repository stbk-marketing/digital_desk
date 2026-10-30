import { expect, test } from '@playwright/test';

test('green workspace capture, search and filter dialogs work with keyboard and mobile', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.goto('/login');
    await page.locator('input[name=email]').fill('anna@example.test');
    await page.locator('input[name=password]').fill('Browser-test-123!');
    await page.locator('button[type=submit]').click();
    await expect(
        page.getByRole('heading', { name: 'Schreibtisch', exact: true }),
    ).toBeVisible();
    const inbox = page.getByRole('button', { name: /Eingang \/ ohne Termin/ });
    await inbox.focus();
    await page.keyboard.press('Space');
    await expect(inbox).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Space');
    await expect(inbox).toHaveAttribute('aria-expanded', 'true');

    const capture = page.getByLabel('Neue Aufgabe', { exact: true });
    const title = 'UI-Abnahme: Angebot gemeinsam vorbereiten';
    await page.getByLabel('Termin für neue Aufgabe').fill('2026-11-07');
    await page
        .getByLabel('Person für neue Aufgabe')
        .selectOption({ label: 'Britta' });
    await page
        .getByLabel('Projekt für neue Aufgabe')
        .selectOption({ label: 'Noch nicht terminiert' });
    await capture.fill(title);
    await capture.press('Enter');
    await expect(capture).toBeFocused();
    const details = page.getByRole('button', {
        name: `Details: ${title}`,
        exact: true,
    });
    await expect(details).toBeEnabled();
    await details.click();
    const panel = page.getByRole('complementary', { name: 'Aufgabendetails' });
    await expect(panel.getByLabel('Frist', { exact: true })).toHaveValue(
        '2026-11-07',
    );
    await expect(panel.getByLabel('Zuständig')).toHaveValue(
        await page.getByLabel('Person für neue Aufgabe').inputValue(),
    );
    await expect(panel.getByLabel('Projekt', { exact: true })).toHaveValue(
        await page.getByLabel('Projekt für neue Aufgabe').inputValue(),
    );
    await page.screenshot({
        path: 'storage/test-results/ui-desktop.png',
        animations: 'disabled',
        fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(details).toBeFocused();

    const searchButton = page.getByRole('button', {
        name: 'Suche öffnen',
        exact: true,
    });
    await searchButton.click();
    const search = page.getByLabel('Alle Aufgaben durchsuchen');
    await expect(search).toBeFocused();
    await search.fill('UI-Abnahme:');
    await expect(page.getByRole('dialog').getByRole('status')).toContainText(
        '1 Aufgaben gefunden',
    );
    await page
        .getByRole('button', { name: 'Ergebnisse anzeigen', exact: true })
        .click();
    await expect(searchButton).toBeFocused();
    await expect(page.locator('.task-row')).toHaveCount(1);
    await searchButton.click();
    await search.fill('kein-treffer-ui-abnahme-987');
    await expect(page.getByRole('dialog').getByRole('status')).toContainText(
        '0 Aufgaben gefunden',
    );
    await page.screenshot({ path: 'storage/test-results/ui-search.png' });
    await page
        .getByRole('button', { name: 'Suchbegriff löschen', exact: true })
        .click();
    await expect(search).toHaveValue('');
    await expect(search).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(searchButton).toBeFocused();
    await page
        .getByRole('button', { name: 'Zurücksetzen', exact: true })
        .click();

    const filterButton = page.getByRole('button', {
        name: 'Filter öffnen',
        exact: true,
    });
    await filterButton.click();
    await page.getByLabel('Statusfilter').selectOption('done');
    await page.screenshot({ path: 'storage/test-results/ui-filters.png' });
    await page
        .getByRole('button', { name: 'Ergebnisse anzeigen', exact: true })
        .click();
    await expect(filterButton).toBeFocused();
    await expect(page.getByLabel('Aktive Suche und Filter')).toContainText(
        'Erledigt',
    );
    await expect(details).toHaveCount(0);
    await page
        .getByRole('button', { name: 'Zurücksetzen', exact: true })
        .click();
    await expect(details).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await filterButton.click();
    await page.getByLabel('Personenfilter').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    if (await page.getByRole('dialog').isVisible())
        await page.keyboard.press('Escape');
    await expect(filterButton).toBeFocused();
    await page.getByRole('button', { name: 'Navigation umschalten' }).click();
    await expect(
        page.getByRole('button', { name: 'Kalender', exact: true }),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Schreibtisch', exact: true })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Schreibtisch', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(capture).toBeFocused();
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
    expect(
        await capture.evaluate(
            (element) => element.getBoundingClientRect().height,
        ),
    ).toBeGreaterThanOrEqual(65);
    await page.screenshot({
        path: 'storage/test-results/ui-mobile.png',
        animations: 'disabled',
        fullPage: true,
    });
});
