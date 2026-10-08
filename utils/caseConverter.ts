const toCamel = (s: string): string => {
  return s.replace(/([-_][a-z])/ig, ($1) => {
    return $1.toUpperCase()
      .replace('-', '')
      .replace('_', '');
  });
};

const toSnake = (s: string): string => {
    // Add an exception for aiFeedback, which is camelCase in the database schema.
    if (s === 'aiFeedback') {
        return s;
    }
    // a check to not add underscore to the beginning of the string
    if (s.startsWith('_')) {
        return s;
    }
    return s.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

const processKeys = <T>(obj: any, processFunc: (s: string) => string): T => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(v => processKeys(v, processFunc)) as any;
    }

    return Object.keys(obj).reduce((acc, key) => {
        const newKey = processFunc(key);
        (acc as any)[newKey] = processKeys(obj[key], processFunc);
        return acc;
    }, {} as T);
}

export const snakeToCamel = <T>(obj: any): T => {
    return processKeys<T>(obj, toCamel);
}

export const camelToSnake = <T>(obj: any): T => {
    return processKeys<T>(obj, toSnake);
}