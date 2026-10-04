import assert from 'node:assert/strict';
import {chromium,webkit,expect} from '@playwright/test';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);await page.goto(base+'/tests/ui/drawguess-rejection.fixture.html');
  const input=page.locator('.dg-guess-form input'),submit=page.locator('.dg-guess-form button'),feedback=page.getByTestId('feedback'),ack=page.getByTestId('acknowledgements');let completed=0;
  const settled=async expected=>{await expect(ack).toHaveText(String(expected));};
  const send=async value=>{await input.fill(value);await submit.click();};

  await send('rejected draft');assert.equal(await input.inputValue(),'rejected draft','fixture retains the draft while a request waits');await expect(submit).toBeDisabled();await expect(feedback).toHaveText('rejected');await settled(++completed);assert.equal(await input.inputValue(),'rejected draft','a delayed rejection retains the draft');await expect(submit).toBeEnabled();

  await page.getByRole('button',{name:'Accept next'}).click();await send('wrong Ａ ');assert.equal(await input.inputValue(),'wrong Ａ ','accepted feedback is not optimistic');await expect(feedback).toHaveText('accepted');await settled(++completed);await expect(input).toHaveValue('');await expect(page.locator('.dg-guesses')).toContainText('wrong A');

  await send('same');await input.fill('same changed');await input.fill('same');await expect(feedback).toHaveText('accepted');await settled(++completed);await expect(input).toHaveValue('same');await expect(submit).toBeEnabled();await submit.click();await expect(feedback).toHaveText('accepted');await settled(++completed);await expect(input).toHaveValue('');

  await page.getByRole('button',{name:'Reset'}).click();await page.getByRole('button',{name:'Fill mixed window'}).click();await expect(page.getByTestId('guess-count')).toHaveText('24');await page.getByRole('button',{name:'Accept next'}).click();await send('window Ａ ');await page.getByRole('button',{name:'Crowd remote'}).click();await expect(input).toHaveValue('window Ａ ');await expect(feedback).toHaveText('accepted');await settled(++completed);await expect(input).toHaveValue('');await expect(page.locator('.dg-guesses')).toContainText('window A');

  await page.getByRole('button',{name:'Reset'}).click();await page.getByRole('button',{name:'Fill ambiguous window'}).click();await expect(page.getByTestId('guess-count')).toHaveText('24');await page.getByRole('button',{name:'Accept next'}).click();await send('repeat');await expect(feedback).toHaveText('accepted');await settled(++completed);await expect(input).toHaveValue('repeat');await expect(submit).toBeEnabled();

  await page.getByRole('button',{name:'Reset'}).click();const answer=await page.getByTestId('answer').innerText();await send(answer);await expect(feedback).toHaveText('accepted');await settled(++completed);await expect(page.locator('.dg-guess-form')).toHaveCount(0);await expect(page.locator('.dg-reveal')).toContainText(answer);

  await page.getByRole('button',{name:'Reset'}).click();await page.getByRole('button',{name:'Accept next'}).click();await send('seat draft');await page.getByRole('button',{name:'Switch seat'}).click();await expect(input).toHaveValue('');await expect(feedback).toHaveText('accepted');await settled(++completed);await expect(input).toHaveValue('');

  await page.getByRole('button',{name:'Reset'}).click();await input.fill('候选答案');await input.dispatchEvent('compositionstart');await input.press('Enter');await expect(input).toHaveValue('候选答案');assert.equal(await ack.innerText(),String(completed),'composition Enter does not dispatch');await input.dispatchEvent('compositionend');const prevented=await input.evaluate(node=>{const event=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true});Object.defineProperty(event,'keyCode',{value:229});return !node.dispatchEvent(event);});assert.equal(prevented,true,'legacy keyCode 229 is prevented');await expect(input).toHaveValue('候选答案');assert.equal(await ack.innerText(),String(completed),'legacy composition Enter does not dispatch');

  assert.deepEqual(errors,[]);await context.close();console.log(`PASS drawguess rejection ${engine} ${locale}: delayed rejection, authoritative acceptance, normalization, generation, reveal, seat reset, and IME guards`);
 }
}finally{await browser.close();}
