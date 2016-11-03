import { unbzip2 } from './util';

const DEFAULT_ENCODING = 'utf8';

class Decoder {

  static utf8(data, callback) {
    callback(null, data.toString('utf8'));
  }

  static bz2(data, callback) {
    unbzip2(data, callback);
  }

}

export default (encoding, data, callback) => {
  if (!encoding) encoding = DEFAULT_ENCODING;

  let decoder = Decoder[encoding];

  if (!decoder)
    return callback(new Error(`Unable to decode: ${encoding}`));

  return decoder(data, callback);
};
