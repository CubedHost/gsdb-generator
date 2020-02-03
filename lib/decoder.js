import { unbzip2 } from './util';

const DEFAULT_ENCODING = 'utf8';

class Decoder {

  static utf8(data) {
    return data.toString('utf8');
  }

  static async bz2(data) {
    return await unbzip2(data);
  }

}

export default (encoding, data) => {
  if (!encoding) encoding = DEFAULT_ENCODING;

  let decoder = Decoder[encoding];

  if (!decoder)
    return callback(new Error(`Unable to decode: ${encoding}`));

  return decoder(data, callback);
};
