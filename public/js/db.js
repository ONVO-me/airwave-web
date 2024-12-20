const openDatabase = (dbName, storeName) => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
                console.log(`Object store '${storeName}' created`);
            }
        };

        request.onsuccess = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.close();
                const version = db.version + 1;
                const upgradeRequest = indexedDB.open(dbName, version);

                upgradeRequest.onupgradeneeded = (upgradeEvent) => {
                    const upgradedDb = upgradeEvent.target.result;
                    upgradedDb.createObjectStore(storeName, { keyPath: 'id' });
                    console.log(`Object store '${storeName}' created during version upgrade`);
                };

                upgradeRequest.onsuccess = (upgradeEvent) => {
                    resolve(upgradeEvent.target.result);
                };

                upgradeRequest.onerror = (upgradeEvent) => {
                    reject(upgradeEvent.target.error);
                };
            } else {
                resolve(db);
            }
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
};

const checkObjectExists = async (id, storeName, dbName = 'musicDB') => {
    const db = await openDatabase(dbName, [storeName]);
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
        const request = store.getKey(id);

        request.onsuccess = () => {
            resolve(!!request.result);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
};

// Get count of all objects in a specific object store (table)
const getObjectCount = async (storeName, dbName = 'musicDB') => {
    const db = await openDatabase(dbName, storeName);
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const countRequest = store.count();

        countRequest.onsuccess = () => {
            resolve(countRequest.result);
        };

        countRequest.onerror = (event) => {
            reject(event.target.error);
        };
    });
};

// Clear all objects in a specific object store (table)
const clearTable = async (storeName, dbName = 'musicDB') => {
    const db = await openDatabase(dbName, storeName);
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    store.clear();

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
            resolve(`Object store '${storeName}' cleared successfully`);
        };

        transaction.onerror = (event) => {
            reject(event.target.error);
        };
    });
};

const setObject = async (id, data, storeName, dbName = 'musicDB') => {
    const db = await openDatabase(dbName, storeName);
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    const object = { id: String(id), ...data };

    return new Promise((resolve, reject) => {
        const request = store.put(object);

        request.onsuccess = () => {
            resolve(`Object with ID ${id} added or overwritten successfully`);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
};

// Update an existing object by its ID (fails if object doesn't exist)
const updateObject = async (id, data, storeName, dbName = 'musicDB') => {
    const db = await openDatabase(dbName, storeName);
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            if (getRequest.result) {
                const updatedObject = { ...getRequest.result, ...data }; // Merge old data with new data
                const updateRequest = store.put(updatedObject);

                updateRequest.onsuccess = () => {
                    resolve(`Object with ID ${id} updated successfully`);
                };

                updateRequest.onerror = (event) => {
                    reject(event.target.error);
                };
            } else {
                reject(`Object with ID ${id} does not exist`);
            }
        };

        getRequest.onerror = (event) => {
            reject(event.target.error);
        };
    });
};

// Get an object by its ID
const getObject = async (id, storeName, dbName = 'musicDB') => {
    const db = await openDatabase(dbName, storeName);
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
        const request = store.get(String(id));

        request.onsuccess = () => {
            if (request.result) {
                resolve(request.result);
            } else {
                reject(`Object with ID ${id} not found`);
            }
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
};

const getAllObjects = async (storeName, dbName = 'musicDB', limit = Infinity, offset = 0) => {
    const db = await openDatabase(dbName, storeName);
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const results = [];

    return new Promise((resolve, reject) => {
        let count = 0;
        const request = store.openCursor();
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                if(storeName == 'downloads' && !cursor.value.poster){
                    cursor.continue();
                    return
                }
                if (count >= offset && results.length < limit) {
                    results.push(cursor.value);
                }
                count++;
                cursor.continue();
            } else {
                resolve(results);
            }
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
};

const removeObject = async (id, storeName, dbName = 'musicDB') => {
    const db = await openDatabase(dbName, storeName);
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
        const request = store.delete(String(id));

        request.onsuccess = () => {
            resolve(`Object with ID ${id} removed successfully`);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
};