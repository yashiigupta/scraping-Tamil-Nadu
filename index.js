const puppeteer = require('puppeteer');
const fs = require('fs');
const { v4 } = require('uuid');
async function getLinks(linkToScrape) {
  const browser = await puppeteer.launch( {headless: true} );
  const page = await browser.newPage();

  await page.goto(linkToScrape);

  const schemes = await page.evaluate(() => Array.from(document.querySelector('.result_inner').querySelectorAll('.scheme_list p a'), e => e.href));
  return schemes;
}

async function scrapeData() {
  var finalResult = [];
  for (let i = 0 ; i < 11 ; i++){
      let linkToScrape = `https://www.tn.gov.in/scheme/alpha_view/All?page=${i}`;
      if (i == 0) linkToScrape = 'https://www.tn.gov.in/scheme/alpha_view/All';
      const websites = await getLinks(linkToScrape);
    
      for(let i = 0; i < websites.length; i++)
      {
        const browser = await puppeteer.launch({headless: false});
        const page = await browser.newPage();
        await page.goto(`${websites[i]}`);
        const data = {};
        const id = v4();
        data["ID"] = id;
        const selectors = ['.node_viewlist_even', '.node_viewlist_odd'];
        for(let selector of selectors)
        {
        const left = await page.evaluate((sel) => {
            return Array.from(document.querySelector('.form-wrapper').querySelectorAll(`${sel} .left_column`), e => e.textContent);
        }, selector);

        const rightCol = await page.evaluate((sel) => {
            return Array.from(document.querySelector('.form-wrapper').querySelectorAll(`${sel} .right_column`), e => e.textContent);
        }, selector);

        const leftCol = left.filter(item => item !== 'Eligibility criteria' && item !== 'Validity of the Scheme' &&  item !== 'Scheme Details');
        for (let i = 0; i < leftCol.length; i++) {
            if(leftCol[i] === 'Description') data[leftCol[i]] = rightCol[i + 1];
            else data[leftCol[i]] = rightCol[i];
        }
        }
        data['URL'] = websites[i];
        const applyNow = await page.evaluate(() => {
            const linkElement = document.querySelector('.csclogin1 a');
            return linkElement ? linkElement.href : null;
        });
        data["Apply Now"] = applyNow;
        await browser.close();
        finalResult.push(data);
  }
    }
  return finalResult;
}

async function writeData() {
  const res = await scrapeData();
  fs.writeFileSync('file.json', JSON.stringify(res, null, 2));
}

writeData();