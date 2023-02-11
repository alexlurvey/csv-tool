import { parseCSV, CellTransform } from '@thi.ng/csv';
import { $compile } from '@thi.ng/rdom';
import { metaStream, reactive, stream, sync, trace } from '@thi.ng/rstream';
import { comp, filter, groupByObj, last, map, minMax, push, scan, transduce } from '@thi.ng/transducers';

const CATEGORY = 'AREA CONTINUOUS';

type RowData = {
    category: string;
    count: string;
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
    const p = value.trim().split('\t').pop()!;
    return parseFloat(p);
}

const salesTx: CellTransform = (value: string) => {
    return parseInt(value.replace(/,/g, ''));
}


const csv_xform = map(({ headers, rows }) => {
    return [...parseCSV({
        all: false,
        cols: {
            'Category Name': { alias: 'category', tx: categoryTx() },
            'Package Configuration Value': { alias: 'count', tx: countTx },
            'Price (Euro)': { alias: 'price', tx: priceTx },
            'Unit Sales': { alias: 'unit_sales', tx: salesTx },
            'Value Sales': { alias: 'value_sales', tx: salesTx },
        }},
        [headers, ...rows])]
});

const row_xform = comp(
    filter((x: RowData) => !isNaN(x.unit_sales)),
    filter((x: RowData) => x.category === CATEGORY),
)

const title = reactive('')
const headers = reactive('')
const rows = reactive<string[]>([])
const csv = sync({ src: { headers, rows }, xform: csv_xform })
const data = csv.map((rows: any[]) => {
    return transduce(row_xform, push(), rows);
})

const minmax_price = data.map((d: RowData[]) => {
    return transduce(comp(
        map((x: RowData) => x.price),
        scan(minMax()),
    ), last(), d)
})

const grouped = data.transform(map<RowData[], Record<string, RowData[]>>((d: RowData[]) => {
    return transduce(scan(groupByObj({ key: (x) => x.count })), last(), d);
}))


const sums_xform = map((x: Record<string, RowData[]>) => {
    if (!x) return null;
    return Object.entries(x).reduce<Record<string, number>>((acc, [k, v]) => {
        acc[k] = v.reduce((a, x) => a + x.unit_sales, 0);
        return acc
    }, {})
});

const group_sums = grouped.transform(sums_xform);

data.subscribe(trace('data'))
minmax_price.subscribe(trace('minmax'))
grouped.subscribe(trace('grouped'))
group_sums.subscribe(trace('sums'))

const onFileUpload = (ev) => {
    const file = ev.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
        const text = ev.target?.result;
        if (typeof text === 'string') {
            const [t, h, ...r] = text.split('\r\n');
            title.next(t);
            headers.next(h);
            rows.next(r)
        }
    }
    reader.readAsText(file)
}

const grid = 

$compile(['div', {},
    ['h1', {}],
    ['div', {},
        ['input', { type: 'file', onchange: onFileUpload }],
    ]
]).mount(document.body)