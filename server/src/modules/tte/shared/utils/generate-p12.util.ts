import forge from 'node-forge';

export function generatePersonalP12(params: {
  nama: string;
  nip: string;
  opdNama: string;
  jabatan: string;
  passphrase: string;
}): Buffer {
  const caKeys = forge.pki.rsa.generateKeyPair({ bits: 2048, workers: 2 });
  const signingKeys = forge.pki.rsa.generateKeyPair({ bits: 2048, workers: 2 });

  const caAttrs = [
    { name: 'commonName', value: 'SOPFlow Root CA' },
    { name: 'organizationName', value: 'Biro Organisasi' },
    { name: 'organizationalUnitName', value: 'Certificate Authority' },
    { name: 'countryName', value: 'ID' },
  ];

  const signingAttrs = [
    { name: 'commonName', value: params.nama },
    { name: 'organizationName', value: params.opdNama },
    { name: 'organizationalUnitName', value: params.jabatan },
    { name: 'serialNumber', value: params.nip },
    { name: 'countryName', value: 'ID' },
  ];

  function serial(suffix: string) {
    return `${new Date().getTime().toString(16)}${suffix}`;
  }

  const caCert = forge.pki.createCertificate();
  caCert.publicKey = caKeys.publicKey;
  caCert.serialNumber = serial('CA');
  const now = new Date();
  caCert.validity.notBefore = now;
  const caExpires = new Date(now);
  caExpires.setFullYear(now.getFullYear() + 10);
  caCert.validity.notAfter = caExpires;
  caCert.setSubject(caAttrs);
  caCert.setIssuer(caAttrs);
  caCert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ]);
  caCert.sign(caKeys.privateKey, forge.md.sha256.create());

  const signingCert = forge.pki.createCertificate();
  signingCert.publicKey = signingKeys.publicKey;
  signingCert.serialNumber = serial('EE');
  signingCert.validity.notBefore = now;
  const signingExpires = new Date(now);
  signingExpires.setFullYear(now.getFullYear() + 5);
  signingCert.validity.notAfter = signingExpires;
  signingCert.setSubject(signingAttrs);
  signingCert.setIssuer(caCert.subject.attributes);
  signingCert.setExtensions([
    { name: 'basicConstraints', cA: false, critical: true },
    {
      name: 'keyUsage',
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
      critical: true,
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true,
      codeSigning: true,
      emailProtection: true,
      timeStamping: true,
    },
    {
      name: 'authorityKeyIdentifier',
      keyIdentifier: (caCert.getExtension('subjectKeyIdentifier') as any)?.value,
    },
  ]);
  signingCert.sign(caKeys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    signingKeys.privateKey,
    [signingCert, caCert],
    params.passphrase,
    { generateLocalKeyId: true, friendlyName: params.nama },
  );

  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(p12Der, 'binary');
}
