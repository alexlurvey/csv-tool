import { $compile, $list } from '@thi.ng/rdom';
import {
    fromIterable,
    ISubscription,
    metaStream,
    reactive,
    stream,
    sync
} from '@thi.ng/rstream';
import {
    groupByObj,
    multiplexObj,
    range,
    reducer,
    scan,
} from '@thi.ng/transducers';
import { cell_flex, NoData, Percent, PriceGroup } from './components';
import { parseCSV, RowData } from './csv';
import { isValidRow } from './utils';

type TableData = {
    totals: Record<number, number>;
    rows: Record<number, RowData[]>;
    columns: Record<number, Record<number, RowData[]>>;
}

const MAX_PRICE_CAT = 50;
const PRICE_CAT_RANGE = 10;

const table_data_xform = (max: number) => multiplexObj<RowData, TableData>({
    totals: scan(groupByObj<RowData, number>({
        key: (x) => Math.min(x.count, max),
        group: reducer(() => 0, (acc, x) => acc + x.unit_sales)
    })),
    rows: scan(groupByObj<RowData, RowData[]>({
        key: (x) => Math.min(Math.ceil(x.price / PRICE_CAT_RANGE) * PRICE_CAT_RANGE, MAX_PRICE_CAT)
    })),
    columns: scan(groupByObj<RowData, Record<number, RowData>>({
        key: (x) => Math.min(x.count, max),
        group: groupByObj({ key: (x) => Math.min(Math.ceil(x.price / PRICE_CAT_RANGE) * PRICE_CAT_RANGE, MAX_PRICE_CAT) })
    }))
})

const category = stream<string>();
const max_count = reactive(8);
const title = reactive('');
const all_rows = reactive<RowData[]>([]);
const categories = all_rows.map((rs) => new Set(rs.map((x) => x.category)));
const table_rows = metaStream<{ rows: RowData[], max: number }, TableData>(({ rows, max }) => {
    return fromIterable(rows).transform(table_data_xform(max)) as unknown as ISubscription<TableData, TableData>;
});

sync({ src: { category, all_rows, max_count }})
    .subscribe({ next: ({ all_rows, category, max_count }) => {
        const next = all_rows.filter((row) => {
            return row.category === category && isValidRow(row)
        });
        table_rows.next({ rows: next, max: max_count });
    }})

const cells = sync({ src: { table_rows, max_count }}).map<Record<string, number[]>>(({ table_rows: { totals, columns }, max_count }) => {
    const table: Record<number, RowData[][]> = Object.entries(columns).reduce((acc, [col, row]) => {
        const idx = parseInt(col) - 1;
        for (const [bucket, d] of Object.entries(row)) {
            acc[bucket] = acc[bucket] || Array(max_count).fill([]);
            acc[bucket][idx] = d;
        }
        return acc;
    }, {})
    const percents = Object.entries(table).reduce((acc, [bucket, row]) => {
        acc[bucket] = row.map((col, i) => {
            const sum = col.reduce((a, y) => a + y.unit_sales, 0)
            return totals[i+1] === 0 ? 0 : (sum / totals[i+1]) * 100;
        })
        return acc;
    }, {})
    return percents;
})

const column_headers = table_rows.map(({ columns }) => {
    let prev = 0;
    return [0, ...Object.keys(columns).flatMap((x) => {
        const num = parseInt(x);
        if (num - 1 !== prev) {
            return [...range(prev + 1, num + 1)]
        }
        prev = num;
        return num;
    })]
})

const sales_dist_ui = table_rows.map(({ totals }) => {
    const all_sales = Object.values(totals).reduce((acc, x) => acc + x, 0);
    let prev = 0;
    const percents = Object.entries(totals).flatMap(([count, num]) => {
        const c = parseInt(count);
        const percent = (num / all_sales) * 100;
        const result = c - 1 === prev ? percent : [...Array.from(range(prev + 1, c), () => 0), percent]
        prev = c;
        return result;
    })
    return [-1, ...percents];
})

const table_ui = cells.map((rows) => {
    return Object.entries(rows).reduce<(string | number)[]>((acc, [group, row]) => {
        acc.push(group, ...row);
        return acc;
    }, [])
})

const onFileUpload = (ev) => {
    const file = ev.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
        const text = ev.target?.result;
        if (typeof text === 'string') {
            const [t, ...rest] = text.split('\r\n');
            title.next(t);
            all_rows.next([...parseCSV(rest)]);
        }
    }
    reader.readAsText(file)
}

const TableCell = (maxcount: number) => {
    let current_bucket = '';

    return ([idx, p]) => {
        if (typeof p === 'string') {
            current_bucket = p;
            return PriceGroup(p, { isLastRow: p === String(MAX_PRICE_CAT) });
        }

        const opts = {
            isLastRow: current_bucket === String(MAX_PRICE_CAT),
            isLastCol: (parseInt(idx) + 1) % (maxcount + 1) === 0
        }

        return p === 0 ? NoData(opts) : Percent(p, opts)
    }
}

const CategoryToggle = (cat: string) => {
    const classes = 'border border-solid border-black cursor-pointer';
    return ['div', { class: classes, onclick: () => category.next(cat) }, cat];
}

$compile(['div', {},
    ['h1', {}, 'CSS Tool' ],
    ['div', {},
        ['input', { class: 'my-4', type: 'file', onchange: onFileUpload }],
        $list(categories.map((x) => [...x]), 'div', { class: 'flex gap-x-2' }, CategoryToggle),
        $list(
            column_headers,
            'div',
            {
                class: 'grid grid-rows-auto',
                style: { 'grid-template-columns': `2fr repeat(${max_count.deref()}, minmax(0, 1fr))` }
            },
            (num: number) => num === 0
                ? ['div', { class: `${cell_flex} min-h-[3rem]` }, 'Pack Size']
                : ['div', { class: `${cell_flex} min-h-[3rem]` }, num === max_count.deref() ? `${num}+` : num]
        ),
        $list(
            sales_dist_ui,
            'div',
            {
                class: 'grid grid-rows-auto',
                style: { 'grid-template-columns': `2fr repeat(${max_count.deref()}, minmax(0, 1fr))` }
            },
            (x: number) => x === -1
                ? ['div',  { class: `${cell_flex} min-h-[3rem]` }, 'Sales Distribution']
                : ['div', { class: `${cell_flex} min-h-[3rem]` }, `${x.toFixed(x < 1 ? 1 : 0)}%`]
        ),
        $list(
            table_ui.map(Object.entries),
            'div',
            {
                class: 'grid grid-rows-auto border-solid border-black border-2',
                style: { 'grid-template-columns': `2fr repeat(${max_count.deref()}, minmax(0, 1fr))` }
            },
            TableCell(max_count.deref()!)
        )
    ]
]).mount(document.body)