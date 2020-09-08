{
	"translatorID": "4ff2bcd8-968c-49bd-94d2-e99c41aeb842",
	"label": "SAGE Journals UBTue",
	"creator": "Sebastian Karcher",
	"target": "^https?://journals\\.sagepub\\.com(/doi/((abs|full|pdf)/)?10\\.|/action/doSearch\\?|/toc/)",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 90,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2019-12-10 18:09:17"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2016 Philipp Zumstein

	This file is part of Zotero.

	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero. If not, see <http://www.gnu.org/licenses/>.

	***** END LICENSE BLOCK *****
*/

// SAGE uses Atypon, but as of now this is too distinct from any existing Atypon sites to make sense in the same translator.

// attr()/text() v2
// eslint-disable-next-line
function attr(docOrElem,selector,attr,index){var elem=index?docOrElem.querySelectorAll(selector).item(index):docOrElem.querySelector(selector);return elem?elem.getAttribute(attr):null;}function text(docOrElem,selector,index){var elem=index?docOrElem.querySelectorAll(selector).item(index):docOrElem.querySelector(selector);return elem?elem.textContent:null;}

function detectWeb(doc, url) {
	if (url.includes('/abs/10.') || url.includes('/full/10.') || url.includes('/pdf/10.') || url.includes('/doi/10.')) {
		return "journalArticle";
	}
	else if (getSearchResults(doc, true)) {
		return "multiple";
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = ZU.xpath(doc, '(//div|//span)[contains(@class, "art_title")]/a[contains(@href, "/doi/full/10.") or contains(@href, "/doi/abs/10.") or contains(@href, "/doi/pdf/10.")][1]');
	for (var i = 0; i < rows.length; i++) {
		var href = rows[i].href;
		var title = ZU.trimInternal(rows[i].textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		href = href.replace("/doi/pdf/", "/doi/abs/");
		items[href] = title;
	}
	return found ? items : false;
}


function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		Zotero.selectItems(getSearchResults(doc, false), function (items) {
			if (!items) {
				return;
			}
			var articles = [];
			for (var i in items) {
				articles.push(i);
			}
			ZU.processDocuments(articles, scrape);
		});
	}
	else {
		scrape(doc, url);
	}
}


function getPublishedPrintYearFromJSON(json) {
	if ("published-print" in json) {
		if ("date-parts" in json["published-print"]) {
			return json["published-print"]["date-parts"][0][0];
		}
	}
	return undefined;
}


function postProcess(doc, item) {
	// remove partial DOIs stored in the pages field of online-first articles
	if (item.DOI) {
		var doiMatches = item.DOI.match(/\b(10[.][0-9]{4,}(?:[.][0-9]+)*\/((?:(?!["&'<>])\S)+))\b/);
		if (doiMatches) {
			var secondPart = doiMatches[2];
			if (item.pages === secondPart) item.pages = "";
		}
	}
}


function scrapedAdditions(item, doc, doi) {
	var abstract = ZU.xpathText(doc, '//article//div[contains(@class, "abstractSection")]/p');
	if (abstract) {
		item.abstractNote = abstract;
	}

	// ubtue: also add translated abstracts
	var ubtueabstract = ZU.xpathText(doc, '//article//div[contains(@class, "tabs-translated-abstract")]/p | //*[contains(concat( " ", @class, " " ), concat( " ", "abstractInFull", " " ))]');
	if (ubtueabstract) {
        item.abstractNote += "\n\n" + ubtueabstract;
	}

	var tagentry = ZU.xpathText(doc, '//kwd-group[1] | //*[contains(concat( " ", @class, " " ), concat( " ", "hlFld-KeywordText", " " ))]');
	if (tags) {
		item.tags = tagentry.split(",");
	}
	// ubtue: add tags "Book Review" if "Review Article"
	var articleType = ZU.xpath(doc, '//span[@class="ArticleType"]/span');
	if (articleType) {
		for (let r of articleType) {
			let reviewDOIlink = r.innerHTML;
			if (reviewDOIlink.match(/Review Article/)) {
				item.tags.push('Book Review');
			}
		}
	}

	// scrape tags
	if (!item.tags || item.tags.length === 0) {
		var embedded = ZU.xpathText(doc, '//meta[@name="keywords"]/@content');
		if (embedded) item.tags = embedded.split(",");
		if (!item.tags) {
			var tags = ZU.xpath(doc, '//div[@class="abstractKeywords"]//a');
			if (tags) item.tags = tags.map(n => n.textContent);
		}
	}

	if (articleType && articleType.length > 0) {
		if (articleType[0].textContent.trim().match(/Book Review/)) {
			item.tags.push("Book Review");
		}
	}

	item.notes = [];
	item.language = ZU.xpathText(doc, '//meta[@name="dc.Language"]/@content');
	let pdfurl = "//" + doc.location.host + "/doi/pdf/" + doi;
	item.attachments.push({
		url: pdfurl,
		title: "SAGE PDF Full Text",
		mimeType: "application/pdf"
	});
	postProcess(doc, item);
}


function extract(text, doc, doi) {
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("bc03b4fe-436d-4a1f-ba59-de4d2d7a63f7");
	translator.setString(text);
	translator.setHandler("itemDone", function (obj, item) {
		let json = JSON.parse(text);
		let publishedPrintYear = getPublishedPrintYearFromJSON(json);
		item.date = publishedPrintYear !== undefined ? publishedPrintYear : "";
		scrapedAdditions(item, doc, doi);
		item.complete();
	});
	translator.translate();
}


function scrape(doc, url) {
	var doi = ZU.xpathText(doc, '//meta[@name="dc.Identifier" and @scheme="doi"]/@content');
	var doiURL = "http://doi.org/" + encodeURIComponent(doi);
	if (!doi) {
		doi = url.match(/10\.[^?#]+/)[0];
	}
	var pdfurl = "//" + doc.location.host + "/doi/pdf/" + doi;
	ZU.doGet(doiURL, function(text) { extract(text, doc, doi); }, undefined, undefined, { Accept: "application/vnd.citationstyles.csl+json;q=1.0" });
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://journals.sagepub.com/doi/abs/10.1177/1754073910380971",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Emotion and Regulation are One!",
				"creators": [
					{
						"firstName": "Arvid",
						"lastName": "Kappas",
						"creatorType": "author"
					}
				],
				"date": "January 1, 2011",
				"DOI": "10.1177/1754073910380971",
				"ISSN": "1754-0739",
				"abstractNote": "Emotions are foremost self-regulating processes that permit rapid responses and adaptations to situations of personal concern. They have biological bases and are shaped ontogenetically via learning and experience. Many situations and events of personal concern are social in nature. Thus, social exchanges play an important role in learning about rules and norms that shape regulation processes. I argue that (a) emotions often are actively auto-regulating—the behavior implied by the emotional reaction bias to the eliciting event or situation modifies or terminates the situation; (b) certain emotion components are likely to habituate dynamically, modifying the emotional states; (c) emotions are typically intra- and interpersonal processes at the same time, and modulating forces at these different levels interact; (d) emotions are not just regulated—they regulate. Important conclusions of my arguments are that the scientific analysis of emotion should not exclude regulatory processes, and that effortful emotion regulation should be seen relative to a backdrop of auto-regulation and habituation, and not the ideal notion of a neutral baseline. For all practical purposes unregulated emotion is not a realistic concept.",
				"issue": "1",
				"journalAbbreviation": "Emotion Review",
				"language": "en",
				"libraryCatalog": "SAGE Journals",
				"pages": "17-25",
				"publicationTitle": "Emotion Review",
				"url": "https://doi.org/10.1177/1754073910380971",
				"volume": "3",
				"attachments": [
					{
						"title": "SAGE PDF Full Text",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "emotion regulation"
					},
					{
						"tag": "facial expression"
					},
					{
						"tag": "facial feedback"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://journals.sagepub.com/toc/rera/86/3",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://journals.sagepub.com/doi/full/10.1177/0954408914525387",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Brookfield powder flow tester – Results of round robin tests with CRM-116 limestone powder",
				"creators": [
					{
						"firstName": "R. J.",
						"lastName": "Berry",
						"creatorType": "author"
					},
					{
						"firstName": "M. S. A.",
						"lastName": "Bradley",
						"creatorType": "author"
					},
					{
						"firstName": "R. G.",
						"lastName": "McGregor",
						"creatorType": "author"
					}
				],
				"date": "August 1, 2015",
				"DOI": "10.1177/0954408914525387",
				"ISSN": "0954-4089",
				"abstractNote": "A low cost powder flowability tester for industry has been developed at The Wolfson Centre for Bulk Solids Handling Technology, University of Greenwich in collaboration with Brookfield Engineering and four food manufacturers: Cadbury, Kerry Ingredients, GSK and United Biscuits. Anticipated uses of the tester are primarily for quality control and new product development, but it can also be used for storage vessel design., This paper presents the preliminary results from ‘round robin’ trials undertaken with the powder flow tester using the BCR limestone (CRM-116) standard test material. The mean flow properties have been compared to published data found in the literature for the other shear testers.",
				"issue": "3",
				"journalAbbreviation": "Proceedings of the Institution of Mechanical Engineers, Part E: Journal of Process Mechanical Engineering",
				"libraryCatalog": "SAGE Journals",
				"pages": "215-230",
				"publicationTitle": "Proceedings of the Institution of Mechanical Engineers, Part E: Journal of Process Mechanical Engineering",
				"url": "https://doi.org/10.1177/0954408914525387",
				"volume": "229",
				"attachments": [
					{
						"title": "SAGE PDF Full Text",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "Shear cell"
					},
					{
						"tag": "BCR limestone powder (CRM-116)"
					},
					{
						"tag": "flow function"
					},
					{
						"tag": "characterizing powder flowability"
					},
					{
						"tag": "reproducibility"
					},
					{
						"tag": "Brookfield powder flow tester"
					},
					{
						"tag": "Jenike shear cell"
					},
					{
						"tag": "Schulze ring shear tester"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://journals.sagepub.com/action/doSearch?AllField=test",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://journals.sagepub.com/doi/full/10.1177/1541204015581389",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Moffitt’s Developmental Taxonomy and Gang Membership: An Alternative Test of the Snares Hypothesis",
				"creators": [
					{
						"firstName": "Melissa A.",
						"lastName": "Petkovsek",
						"creatorType": "author"
					},
					{
						"firstName": "Brian B.",
						"lastName": "Boutwell",
						"creatorType": "author"
					},
					{
						"firstName": "J. C.",
						"lastName": "Barnes",
						"creatorType": "author"
					},
					{
						"firstName": "Kevin M.",
						"lastName": "Beaver",
						"creatorType": "author"
					}
				],
				"date": "October 1, 2016",
				"DOI": "10.1177/1541204015581389",
				"ISSN": "1541-2040",
				"abstractNote": "Moffitt’s taxonomy remains an influential theoretical framework within criminology. Despite much empirical scrutiny, comparatively less time has been spent testing the snares component of Moffitt’s work. Specifically, are there factors that might engender continued criminal involvement for individuals otherwise likely to desist? The current study tested whether gang membership increased the odds of contact with the justice system for each of the offender groups specified in Moffitt’s original developmental taxonomy. Our findings provided little evidence that gang membership increased the odds of either adolescence-limited or life-course persistent offenders being processed through the criminal justice system. Moving forward, scholars may wish to shift attention to alternative variables—beyond gang membership—when testing the snares hypothesis.",
				"issue": "4",
				"journalAbbreviation": "Youth Violence and Juvenile Justice",
				"libraryCatalog": "SAGE Journals",
				"pages": "335-349",
				"publicationTitle": "Youth Violence and Juvenile Justice",
				"shortTitle": "Moffitt’s Developmental Taxonomy and Gang Membership",
				"url": "https://doi.org/10.1177/1541204015581389",
				"volume": "14",
				"attachments": [
					{
						"title": "SAGE PDF Full Text",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "Moffitt’s developmental taxonomy"
					},
					{
						"tag": "gang membership"
					},
					{
						"tag": "snares"
					},
					{
						"tag": "delinquency"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/