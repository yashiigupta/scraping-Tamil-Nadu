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

  for (let i = 0 ; i < 11 ; i++)
  {
    let linkToScrape = `https://www.tn.gov.in/scheme/alpha_view/All?page=${i}`;
    if (i == 0) linkToScrape = 'https://www.tn.gov.in/scheme/alpha_view/All';
    const websites = await getLinks(linkToScrape);
  
    for(let i = 0; i < websites.length; i++)
    {
      const browser = await puppeteer.launch({headless: false});
      const page = await browser.newPage();
      await page.goto(`${websites[i]}`);
        
      const placeholders = {
        "Title/Name": "scheme_name",
        "Beneficiaries": "beneficiary_category",
        "SponsoredBy": "funding_by",
        "Description": "scheme_objective",
        "HowToAvail": "application_process",
        "ConcernedDepartment": "category",
        "Income": "income",
        "Age": "age",
        "Community": "community",
        "OtherDetails": "other_details",
        "FundingPattern": "funding_pattern",
        "BenefitsTypes": "benefit_types"
      }

      const data = {};
      const id = v4();
      data["id"] = id;
      const selectors = ['.node_viewlist_even', '.node_viewlist_odd'];
      for(let selector of selectors)
      {
        const left = await page.evaluate((sel) => {
          return Array.from(document.querySelector('.form-wrapper').querySelectorAll(`${sel} .left_column`), e => e.textContent);
        }, selector);

        const rightCo = await page.evaluate((sel) => {
            return Array.from(document.querySelector('.form-wrapper').querySelectorAll(`${sel} .right_column`), e => {
              if(e.textContent.includes(".pdf")) return e.href;
              else return e.textContent;
        });}, selector);

        const leftCo = left.filter(item => item !== 'Eligibility criteria' && item !== 'Validity of the Scheme' &&  item !== 'Scheme Details');
        const leftCol = leftCo.map(item => item.replaceAll(" ", ""));

        const rightCol = rightCo.map(item => item ? item.replace(/[\b\f\n\r\t\v\'\"\\]/g, "") : "");

        //code for adding placeholder "eligibilty_criteria"
        if(selector === ".node_viewlist_even")
        {
          const eligiblity = {};
          for(let i = 0; i < leftCol.length; i++)
          {
            if(leftCol[i] === "Income" || leftCol[i] === "Age" || leftCol[i] === "Community") eligiblity[leftCol[i]] = rightCol[i];
            else if(leftCol[i] === "OtherDetails" && rightCol[i] !== "--")
            {
              let result = rightCol[i].split(/(\d+\.\s?)/).filter(Boolean);
              let finalResult = [];
              for (let i = 0; i < result.length; i += 2) {
                  finalResult.push(result[i] + result[i + 1]);
              }
              eligiblity[leftCol[i]] = finalResult;
            }
            else if(leftCol[i] === "OtherDetails") eligiblity[leftCol[i]] = rightCol[i];
          }
          data["eligibility_criteria"] = eligiblity;
        }

        //code for adding placeholder "benefit_category"
        if(selector === ".node_viewlist_odd")
        {
          const benefit = {}
          for(let i = 0; i < leftCol.length; i++)
          {
            if(leftCol[i] === "FundingPattern" || leftCol[i] === "BenefitsTypes") benefit[leftCol[i]] = rightCol[i];
          }
          data["benefits_provided"] = benefit;
        }

        for (let i = 0; i < leftCol.length; i++) {
          for(let x in placeholders)
          {
            if(x === leftCol[i] && leftCol[i] === "Description") data[placeholders[x]] = rightCol[i + 1];
            else if(x === leftCol[i]) data[placeholders[x]] = rightCol[i];
          }
        }
      }
      data['url'] = websites[i];
      const applyNow = await page.evaluate(() => {
          const linkElement = document.querySelector('.csclogin1 a');
          return linkElement ? linkElement.href : null;
      });
      data["contact_office"] = applyNow;
      await browser.close();
      finalResult.push(data);
    }
  }
  return finalResult;
}

async function writeData() {
  const res = await scrapeData();
  fs.writeFileSync('final.json', JSON.stringify(res, null, 2));
}

writeData();