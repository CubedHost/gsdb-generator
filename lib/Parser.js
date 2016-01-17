import xml2js from 'xml2js';

const HTML_ANCHOR_REGEX = /<a[^>]*(?:href="([^"]*)")[^>]*>([\s\S]*?)<\/a>/g;

const Parser = { };

Parser.index = function index(html, callback) {
  if (typeof html !== 'string')
    return callback(new Error('Invalid input data'));

  let anchors = { };
  let match;

  while ((match = HTML_ANCHOR_REGEX.exec(html)) !== null) {
    // Skip parent directory link
    if (/\.\.\/$/.test(match[1])) continue;

    // Skip invalid match
    if (match.length < 3) continue;

    anchors[match[2]] = match[1];
  }

  return callback(null, anchors);
};

Parser.json = function json(data, callback) {
  let parsed;

  try {
    parsed = JSON.parse(data);
  } catch (err) {
    return callback(err);
  }

  return callback(null, parsed);
}

Parser.raw = function raw(data, callback) {
  return callback(null, data);
}

Parser.xml = function xml(data, callback) {
  return new xml2js.Parser({ explicitArray: true })
    .parseString(data, (err, result) => {
      callback(err, result);
    });
}

export default (format, data, callback) => {
  let parser = Parser[format];

  if (!parser)
    return callback(new Error('Invalid format or none specified'));

  return parser(data, callback);
}

export { Parser };
