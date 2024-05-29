// Copyright Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache 2.0

import { IV2GCertificateAuthorityClient } from './interface';
import { SystemConfig } from '@citrineos/base';
import { ILogObj, Logger } from 'tslog';

export class Hubject implements IV2GCertificateAuthorityClient {
  private readonly _baseUrl: string;
  private readonly _isoVersion: string;
  private readonly _tokenUrl: string;
  private _logger: Logger<ILogObj>;

  constructor(config: SystemConfig, logger?: Logger<ILogObj>) {
    if (!config.modules.certificates?.v2gCA.hubject) {
      throw new Error('Missing Hubject configuration');
    }

    this._baseUrl = config.modules.certificates?.v2gCA.hubject.baseUrl;
    this._tokenUrl = config.modules.certificates?.v2gCA.hubject.tokenUrl;
    this._isoVersion = config.modules.certificates?.v2gCA.hubject.isoVersion;

    this._logger = logger
      ? logger.getSubLogger({ name: this.constructor.name })
      : new Logger<ILogObj>({ name: this.constructor.name });
  }

  /**
   * Retrieves a signed certificate based on the provided CSR.
   * DOC: https://hubject.stoplight.io/docs/open-plugncharge/486f0b8b3ded4-simple-enroll-iso-15118-2-and-iso-15118-20
   *
   * @param {string} csrString - The certificate signing request from SignCertificateRequest.
   * @return {Promise<string>} The signed certificate without header and footer.
   */
  async getSignedCertificate(csrString: string): Promise<string> {
    const url = `${this._baseUrl}/cpo/simpleenroll/${this._isoVersion}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/pkcs10',
        Authorization: await this._getAuthorizationToken(this._tokenUrl),
        'Content-Type': 'application/pkcs10',
      },
      body: csrString,
    });

    if (response.status !== 200) {
      throw new Error(
        `Get signed certificate response is unexpected: ${response.status}: ${await response.text()}`,
      );
    }

    return await response.text();
  }

  /**
   * Retrieves the CA certificates including sub CAs and root CA.
   * DOC: https://hubject.stoplight.io/docs/open-plugncharge/e246aa213bc22-obtaining-ca-certificates-iso-15118-2-and-iso-15118-20
   *
   * @return {Promise<string>} The CA certificates.
   */
  async getCACertificates(): Promise<string> {
    const url = `${this._baseUrl}/cpo/cacerts/${this._isoVersion}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/pkcs10, application/pkcs7',
        Authorization: await this._getAuthorizationToken(this._tokenUrl),
        'Content-Transfer-Encoding': 'application/pkcs10',
      },
    });

    if (response.status !== 200) {
      throw new Error(
        `Get CA certificates response is unexpected: ${response.status}: ${await response.text()}`,
      );
    }

    return await response.text();
  }

  private async _getAuthorizationToken(tokenUrl: string): Promise<string> {
    const response = await fetch(tokenUrl, { method: 'GET' });
    if (!response.ok && response.status !== 304) {
      throw new Error(
        `Get token response is unexpected: ${response.status}: ${await response.text()}`,
      );
    }
    return this._parseBearerToken((await response.json()).data);
  }

  /**
   * Parses the Bearer token from the input token
   * which is expected to be in the format of "XXXXBearer <token>\nXXXXX"
   *
   * @param {string} token - The input token string to parse.
   * @return {string} The parsed Bearer token string.
   */
  private _parseBearerToken(token: string): string {
    let tokenValue: string = token.split('Bearer ')[1];
    tokenValue = tokenValue.split('\n')[0];
    return 'Bearer ' + tokenValue;
  }
}
