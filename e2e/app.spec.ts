import { expect, test, type Page } from '@playwright/test';

const uniqueTitle = (prefix: string) => `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const openNewWorkoutEditor = async (page: Page) => {
  const startNowButton = page.getByRole('button', { name: /Start Now|立即开始/ });

  if ((await startNowButton.count()) > 0) {
    await startNowButton.first().click();
  } else {
    await page.getByTestId('fab-add-workout').click({ force: true });
  }

  await expect(page).toHaveURL(/#\/workout\/new/);
  await expect(page.getByTestId('workout-title-input')).toBeVisible();
};

const completeWorkout = async (title: string, page: Page) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();

  await openNewWorkoutEditor(page);
  await page.getByTestId('workout-title-input').fill(title);
  await page.getByTestId('add-exercise-button').click();
  await page.getByRole('button', { name: 'Create New' }).click();
  await page.getByPlaceholder('Name').fill(`${title} Exercise`);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.locator('[data-testid^="set-complete-"]').first().click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByTestId('finish-workout-button').click({ force: true });

  await expect(page.getByText('Save as Template?')).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText('Workout Complete')).toBeVisible();
  await page.getByRole('button', { name: 'Back to Home' }).click();
  await expect(page).toHaveURL(/#\/$/);
};

test('login flow reaches dashboard in e2e bypass mode', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();
});

test('create workout, add exercise, log set, and finish workout', async ({ page }) => {
  const title = uniqueTitle('E2E Push Workout');
  await completeWorkout(title, page);

  await page.goto('/#/history');
  await expect(page.getByText(title)).toBeVisible();
});

test('history filter and delete workout', async ({ page }) => {
  const title = uniqueTitle('E2E Delete Workout');
  await completeWorkout(title, page);

  await page.goto('/#/history');
  await page.getByTestId('history-filter-button').click();
  await page.getByPlaceholder('Chest, Leg Day...').fill(title);
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 30000 });

  const rowTitle = page.getByRole('heading', { name: title }).first();
  const row = rowTitle.locator('xpath=../../..');
  const box = await row.boundingBox();
  if (!box) throw new Error('Failed to locate history row');

  const point = {
    clientX: box.x + 16,
    clientY: box.y + 16,
    pointerType: 'touch',
  };
  await row.dispatchEvent('pointerdown', point);
  await page.waitForTimeout(650);
  await row.dispatchEvent('pointerup', point);

  await expect(page.getByRole('heading', { name: 'Workout Options' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Workout', exact: true }).click();
  await expect(page.getByText('Are you sure you want to delete this workout?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, Delete' }).click();

  await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
});

test('export data as json and csv', async ({ page }) => {
  const title = uniqueTitle('E2E Export Workout');
  await completeWorkout(title, page);

  await page.goto('/#/profile/settings');

  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'JSON' }).click(),
  ]);
  expect(jsonDownload.suggestedFilename().toLowerCase()).toContain('.json');

  const [csvDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV' }).click(),
  ]);
  expect(csvDownload.suggestedFilename().toLowerCase()).toContain('.csv');
});

test('save template and start workout from template', async ({ page }) => {
  const title = uniqueTitle('E2E Template Save Workout');
  const expectedTemplateName = `${title} Template`;

  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();
  await openNewWorkoutEditor(page);
  await page.getByTestId('workout-title-input').fill(title);
  await page.getByTestId('add-exercise-button').click();
  await page.getByRole('button', { name: 'Create New' }).click();
  await page.getByPlaceholder('Name').fill(`${title} Exercise`);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.locator('[data-testid^="set-complete-"]').first().click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByTestId('finish-workout-button').click({ force: true });

  await expect(page.getByText('Save as Template?')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Workout Complete')).toBeVisible();
  await page.getByRole('button', { name: 'Back to Home' }).click();

  await page.getByRole('button', { name: 'From Template' }).click();
  await expect(page.getByText('No templates yet. Save one after finishing a workout.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: new RegExp(expectedTemplateName) })).toBeVisible();

  await page.getByRole('button', { name: new RegExp(expectedTemplateName) }).click();
  await page.getByRole('button', { name: 'Start Workout' }).click();
  await expect(page).toHaveURL(/#\/workout\//);
});
