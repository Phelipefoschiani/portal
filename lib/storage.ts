
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'portal_centro_norte_db';
const DB_VERSION = 1;
const STORE_NAME = 'encrypted_data';

// Chave de criptografia simples (em um cenário real, isso viria de um processo de derivação mais complexo)
// Usaremos o userId como parte da semente para que cada usuário tenha sua própria "visão" criptografada
const getEncryptionKey = async (userId: string): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(userId + 'pcn-secret-salt-2026');
    const hash = await crypto.subtle.digest('SHA-256', data);
    
    return await crypto.subtle.importKey(
        'raw',
        hash,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
};

export const encryptData = async (data: unknown, userId: string): Promise<{ iv: Uint8Array; content: ArrayBuffer }> => {
    const key = await getEncryptionKey(userId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(JSON.stringify(data));
    
    const encryptedContent = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encodedData
    );
    
    return { iv, content: encryptedContent };
};

export const decryptData = async (encryptedData: { iv: Uint8Array; content: ArrayBuffer }, userId: string): Promise<unknown> => {
    const key = await getEncryptionKey(userId);
    
    const decryptedContent = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: encryptedData.iv as BufferSource },
        key,
        encryptedData.content
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedContent));
};

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            },
        });
    }
    return dbPromise;
};

export const saveToLocal = async (key: string, data: unknown, userId: string) => {
    try {
        const encrypted = await encryptData(data, userId);
        const db = await getDB();
        await db.put(STORE_NAME, encrypted, key);
    } catch (error) {
        console.error('Erro ao salvar localmente:', error);
    }
};

export const getFromLocal = async (key: string, userId: string) => {
    try {
        const db = await getDB();
        const encrypted = await db.get(STORE_NAME, key);
        if (!encrypted) return null;
        return await decryptData(encrypted, userId);
    } catch (error) {
        console.error('Erro ao recuperar localmente:', error);
        return null;
    }
};

export const clearLocal = async () => {
    const db = await getDB();
    await db.clear(STORE_NAME);
};
