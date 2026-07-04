import * as openpgp from "openpgp";

export async function encryptMessage(plaintext: string, publicKeysArmored: string[]) {
  const publicKeys = await Promise.all(
    publicKeysArmored.map((armored) => openpgp.readKey({ armoredKey: armored })),
  );
  const message = await openpgp.createMessage({ text: plaintext });
  const encrypted = await openpgp.encrypt({
    message,
    encryptionKeys: publicKeys,
  });
  return String(encrypted);
}

export async function signMessage(plaintext: string, privateKeyArmored: string, passphrase?: string) {
  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: privateKeyArmored }),
    passphrase: passphrase || "",
  });
  const message = await openpgp.createMessage({ text: plaintext });
  const signed = await openpgp.sign({
    message,
    signingKeys: privateKey,
    detached: true,
  });
  return String(signed);
}
