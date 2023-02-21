import { parseCSV as parse, CellTransform } from '@thi.ng/csv';

export type RowData = {
    category: string;
    count: number;
    price: number;
    unit_sales: number;
    value_sales: number;
}

const categoryTx = (): CellTransform => {
    let current = '';
    return (name: string) => {
        if (name !== '') {
            current = name;
        }
        return current;
    }
}

const countTx: CellTransform = (value: string) => {
    if (!value) return 0;
    const res = value.split(/\s(.*)/);
    const num = res[res.length - 2];
    if (num === 'AO') return 1;
    if (num.includes('+')) {
        return num
            .split('+')
            .filter((x) => x.trim()?.length)
            .reduce((acc, x) => acc + parseInt(x), 0);
    }
    return parseInt(num);
}

const priceTx: CellTransform = (value: string) => {
    const p = value.trim().split(/[\t\s]/).pop()!;
    return parseFloat(p);
}

const salesTx: CellTransform = (value: string) => {
    return parseInt(value.replace(/,/g, ''));
}

export const parseCSV = (rows: any[]) => {
    return parse({
        all: false,
        cols: {
            'Category Name': { alias: 'category', tx: categoryTx() },
            'Package Configuration Value': { alias: 'count', tx: countTx },
            'Price (Euro)': { alias: 'price', tx: priceTx },
            ' Price (Euro) ': { alias: 'price', tx: priceTx },
            'Unit Sales': { alias: 'unit_sales', tx: salesTx },
            'Value Sales': { alias: 'value_sales', tx: salesTx },
        }},
        rows
    ) as IterableIterator<RowData>
}