import cheerio from 'cheerio';
import xml2js from 'xml2js';
import octokit from '@octokit/rest';

const HTML_ANCHOR_REGEX = /<a[^>]*(?:href="([^"]*)")[^>]*>([\s\S]*?)<\/a>/g;

const Parser = { };

Parser.index = function index(html) {
  if (typeof html !== 'string')
    return new Error('Invalid input data');

  let anchors = { };
  let match;

  while ((match = HTML_ANCHOR_REGEX.exec(html)) !== null) {
    // Skip parent directory link
    if (/\.\.\/$/.test(match[1])) continue;

    // Skip invalid match
    if (match.length < 3) continue;

    anchors[match[2]] = match[1];
  }

  return anchors;
};

Parser.json = function json(data) {
  let parsed;

  try {
    parsed = JSON.parse(data);
  } catch (err) {
    let snippet = data.toString().substring(0, 250);
    return new Error(`Malformed JSON data: ${snippet}`);
  }

  return parsed;
}

Parser.raw = function raw(data) {
  return data;
}

Parser.xml = function xml(data) {
  return new xml2js.Parser({ explicitArray: true })
    .parseString(data);
}

Parser.html = function html(data) {
  return cheerio.load(data);
}

export default (format, data) => {
  let parser = Parser[format];

  if (!parser)
    return new Error('Invalid format or none specified');

  return parser(data);
}

export { Parser };
