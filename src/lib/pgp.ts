import * as openpgp from "openpgp";

export function looksLikePgpMessage(text?: string | null) {
  if (!text) return false;
  return (
    text.includes("-----BEGIN PGP MESSAGE-----") ||
    text.includes("-----BEGIN PGP SIGNED MESSAGE-----")
  );
}

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

export async function decryptMessage(
  armored: string,
  privateKeyArmored: string,
  passphrase?: string,
) {
  let privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  if (!privateKey.isDecrypted()) {
    privateKey = await openpgp.decryptKey({
      privateKey,
      passphrase: passphrase || "",
    });
  }
  const message = await openpgp.readMessage({ armoredMessage: armored });
  const { data } = await openpgp.decrypt({
    message,
    decryptionKeys: privateKey,
  });
  return String(data);
}

export async function signAndEncryptMessage(
  plaintext: string,
  publicKeysArmored: string[],
  privateKeyArmored: string,
  passphrase?: string,
) {
  const publicKeys = await Promise.all(
    publicKeysArmored.map((armored) => openpgp.readKey({ armoredKey: armored })),
  );
  let privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  if (!privateKey.isDecrypted()) {
    privateKey = await openpgp.decryptKey({
      privateKey,
      passphrase: passphrase || "",
    });
  }
  const message = await openpgp.createMessage({ text: plaintext });
  const encrypted = await openpgp.encrypt({
    message,
    encryptionKeys: publicKeys,
    signingKeys: privateKey,
  });
  return String(encrypted);
}
