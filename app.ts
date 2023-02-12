import { parseCSV, CellTransform } from '@thi.ng/csv';
import { $compile, $list } from '@thi.ng/rdom';
import { reactive, sync, trace } from '@thi.ng/rstream';
import { comp, filter, groupByObj, last, map, minMax, push, range, scan, transduce } from '@thi.ng/transducers';

const CATEGORY = 'AREA CONTINUOUS';
const MAX_PRICE_CAT = 50;
const PRICE_CAT_RANGE = 10;
const MAX_COUNT = 8;

const clamp = (x: number, lower: number, upper: number) => {
    if (x < lower) return lower;
    if (x > upper) return upper;
    return x;
}

type RowData = {
    category: string;
    count: number;
    price: number;
    unit_sales: number;
    value_sales: number;
}

const cell_flex = 'flex justify-center items-center';
const cell_border = (lastRow = false, lastCol = false) => `${lastRow ? '' : 'border-b-2'} ${lastCol ? '' : 'border-r-2'}`.trim();
const cell_style = `${cell_flex} min-w-min border-solid p-1 min-h-[4rem]`;

const price_labels = {
    10: '€0.00 - 9.99',
    20: '€10.00 - 19.99',
    30: '€20.00 - 29.99',
    40: '€30.00 - 39.99',
    50: '> €49.99',
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

const totals_by_count = data.transform(map((d) => {
    return d.reduce<[number, number[]]>((acc, x) => {
        const c = clamp(x.count, 1, MAX_COUNT);
        acc[0] = acc[0] + x.unit_sales;
        acc[1][c] =  acc[1][c] + x.unit_sales;
        return acc;
    }, [0, [-1, ...Array(MAX_COUNT).fill(0)]]);
}))
const sales_dist_ui = totals_by_count.transform(map(([total, indv]) => {
    if (total <= 0) return indv;
    return indv.map((x, i) => i === 0 ? x : (x / total) * 100);
}))
sales_dist_ui.subscribe(trace('sales dist'))

const minmax_price = data.map((d: RowData[]) => {
    return transduce(comp(
        map((x: RowData) => x.price),
        scan(minMax()),
    ), last(), d)
})

const minmax_count = data.map<[number, number]>((d: RowData[]) => {
    return transduce(comp(
        map((x: RowData) => x.count),
        scan(minMax()),
    ), last(), d)
})

const grouped = data.transform(map<RowData[], Record<string, RowData[]>>((rows: RowData[]) => {
    if (!rows) return {};
    return transduce(
        scan(groupByObj({
            key: (x) => Math.min(Math.ceil(x.price / PRICE_CAT_RANGE) * PRICE_CAT_RANGE, MAX_PRICE_CAT)
        })),
        last(),
        rows
    );
}))

const cells = (r: RowData[], max_bundle: number, bucket: string) => {
    const total_sales = r.reduce((acc, x) => acc + x.unit_sales, 0)
    const sums = r.reduce<number[]>((acc, x) => {
        const c = clamp(x.count, 1, max_bundle)
        acc[c - 1] = acc[c - 1] + x.unit_sales;
        return acc;
    }, Array(max_bundle).fill(0));
    return sums.map<[number | string, { bucket: string; count: number }]>((s, i) => [(s / total_sales) * 100, { bucket, count: i+1 }])
}

const row_ui = grouped.transform(map((x) => {
    return x ? Object.entries(x).flatMap(
        ([bucket, data]) => {
            const cat = [bucket, { bucket, count: 0 }];
            const cs = cells(data, MAX_COUNT, bucket);
            return [cat, ...cs];
        }) : []
    }))


const pack_size_ui = minmax_count.map(([_, max]) => {
    return max === Infinity || max === -Infinity ? [] : Array(MAX_COUNT + 1).fill(null).map((_, i) => i);
});

data.subscribe(trace('data'))
minmax_count.subscribe(trace('minmax'))
grouped.subscribe(trace('grouped'))

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

const percent = (p: number, count: number, bucket: string) => {
    return [
        'div',
        { class: `${cell_style} ${cell_border(bucket === MAX_PRICE_CAT.toString(), count === MAX_COUNT)}`, style: { 'background-color': `rgba(0, 100, 0, ${(clamp(p, 10, 90) / 100).toFixed(2)})` } },
        `${p.toFixed(2)}%`
    ]
}

const nodata = (count: number, bucket: string) => [
    'div',
    { class: `${cell_style} ${cell_border(bucket === MAX_PRICE_CAT.toString(), count === MAX_COUNT)}` },
    'No Sales'
]

const priceGroup = (num: string) => ['div', { class: `${cell_style} ${cell_border(num === MAX_PRICE_CAT.toString())}` }, price_labels[num]];

$compile(['div', {},
    ['h1', {}, 'CSS Tool' ],
    ['div', {},
        ['input', { class: 'my-4', type: 'file', onchange: onFileUpload }],
        $list(
            pack_size_ui,
            'div',
            {
                class: 'grid grid-rows-auto',
                style: { 'grid-template-columns': `2fr repeat(${MAX_COUNT}, minmax(0, 1fr))` }
            },
            (num: number) => num === 0
                ? ['div', { class: `${cell_flex} min-h-[3rem]` }, 'Pack Size']
                : ['div', { class: `${cell_flex} min-h-[3rem]` }, num === MAX_COUNT ? `${num}+` : num]
        ),
        $list(
            sales_dist_ui,
            'div',
            {
                class: 'grid grid-rows-auto',
                style: { 'grid-template-columns': `2fr repeat(${MAX_COUNT}, minmax(0, 1fr))` }
            },
            (x: number) => x === -1
                ? ['div',  { class: `${cell_flex} min-h-[3rem]` }, 'Sales Distribution']
                : ['div', { class: `${cell_flex} min-h-[3rem]` }, `${x.toFixed(x < 1 ? 1 : 0)}%`]
        ),
        $list(
            row_ui,
            'div',
            {
                class: 'grid grid-rows-auto border-solid border-black border-2',
                style: { 'grid-template-columns': `2fr repeat(${MAX_COUNT}, minmax(0, 1fr))` }
            },
            ([p, { count, bucket }]: any) => typeof p === 'string' ? priceGroup(p) : p === 0 ? nodata(count, bucket) : percent(p, count, bucket)
        )
    ]
]).mount(document.body)