import {test,expect} from '@playwright/test';
test('role path grades answers, preserves legacy drafts and supports a phone',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('mp-learning-v1'))localStorage.setItem('mp-learning-v1',JSON.stringify({python0:{draft:'Existing notes'}}));});
 await page.goto('/learning/role.html');
 await expect(page.getByRole('heading',{name:'Python for reliable tests'})).toBeVisible();
 await page.getByLabel('Only 50',{exact:true}).check();await page.getByRole('button',{name:'Check answer',exact:true}).click();
 await expect(page.locator('#score')).toHaveText('0 / 36 milestones');
 await page.getByLabel('True, because bool is a subclass of int',{exact:true}).check();await page.getByRole('button',{name:'Check answer',exact:true}).click();
 await expect(page.locator('#score')).toHaveText('1 / 36 milestones');
 await page.getByLabel('My code or test approach').fill('<script>unsafe()</script>');
 await page.getByLabel('Preparation pace').selectOption('rapid');
 await expect(page.locator('#schedule')).toContainText('7: mock interview');
 await page.getByRole('button',{name:'Practice lab',exact:true}).click();
 await page.getByRole('button',{name:'Deliver cmd-7',exact:true}).click();await page.getByRole('button',{name:'Deliver duplicate cmd-7'}).click();
 await expect(page.locator('#actions')).toHaveText('Applied actions: 1');
 const download=page.waitForEvent('download');await page.getByRole('link',{name:'Download practice project'}).click();expect((await download).suggestedFilename()).toBe('component-practice.zip');
 await page.getByRole('button',{name:'My experience',exact:true}).click();await page.getByLabel('My evidence bank',{exact:false}).fill('Real project notes');
 await page.getByRole('button',{name:'Mock interview',exact:true}).click();await page.getByLabel('My answer',{exact:true}).fill('Explain isolation');await page.getByRole('button',{name:'Reveal answer guide'}).click();await expect(page.locator('#mock-guide')).toBeVisible();
 await page.getByRole('button',{name:'Next question',exact:true}).click();await expect(page.locator('#mock-guide')).toBeHidden();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.goto('/learning/lab.html');await page.getByLabel('I can explain this concept').check();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mp-learning-v1')||'{}'));
 expect(saved.role.units.python.quiz).toBe(true);expect(saved.role.units.python.draft).toBe('<script>unsafe()</script>');expect(saved.role.story).toBe('Real project notes');
});
test('role notes survive reload and blocked storage reports the limit',async({page})=>{
 await page.goto('/learning/role.html');await page.getByLabel('My code or test approach').fill('Boundary notes');await page.reload();await expect(page.getByLabel('My code or test approach')).toHaveValue('Boundary notes');
 await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('blocked')};});await page.reload();await page.getByLabel('I can explain this concept').check();await expect(page.locator('#storage')).toContainText('unavailable');
});
