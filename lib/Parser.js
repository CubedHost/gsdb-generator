import xml2js from 'xml2js';

const Parser = { };

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

  if (!parser) return callback(new Error('Invalid format or none specified'));

  return parser(data, callback);
}

export { Parser };
