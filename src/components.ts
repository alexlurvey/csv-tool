import { Stream } from '@thi.ng/rstream';
import { clamp } from "./utils";

export const cell_flex = 'flex justify-center items-center';
const cell_border = (lastRow = false, lastCol = false) => `border-slate-300 ${lastRow ? '' : 'border-b'} ${lastCol ? '' : 'border-r'}`;
const cell_style = `${cell_flex} min-w-min border-solid p-1 min-h-[4rem]`;

const price_labels = {
    10: '€0.00 - 9.99',
    20: '€10.00 - 19.99',
    30: '€20.00 - 29.99',
    40: '€30.00 - 39.99',
    50: '> €49.99',
}

const NoData = ({ isLastRow = false, isLastCol = false } = {}) => {
    const classes = `${cell_style} ${cell_border(isLastRow, isLastCol)}`.trim();
    return ['div', { class: classes }, 'No Sales']
}

const Percent = (percent: number, { isLastRow = false, isLastCol = false } = {}) => {
    const classes = `${cell_style} ${cell_border(isLastRow, isLastCol)}`.trim();
    const value = isNaN(percent) ? 0 : percent < 1 ? percent.toFixed(2) : percent < 10 ? percent.toFixed(1) : percent.toFixed(0);
    const background = `rgba(0, 100, 0, ${(clamp(percent, 10, 90) / 100).toFixed(2)})`;

    return [
        'div',
        { class: classes, style: { 'background-color': background } },
        `${value}%`
    ]
}

const PriceGroup = (bucket: string, { isLastRow = false } = {}) => {
    const classes = `${cell_style} ${cell_border(isLastRow)}`.trim();
    return  ['div', { class: classes }, price_labels[bucket]];
}


export const CategoryToggle = (cat: string, current: Stream<string>, onclick: () => void) => {
    const bg = { 'background-color': current.map((x) => cat === x ? 'rgba(0,103,103,0.5)' : 'white' ) };
    const classes = `border border-solid border-black cursor-pointer p-2`;
    return ['div', { class: classes, onclick, style: bg }, cat];
}


export const TableCell = (maxcount: number, maxprice: number) => {
    let current_bucket = '';

    return ([idx, p]) => {
        if (typeof p === 'string') {
            current_bucket = p;
            return PriceGroup(p, { isLastRow: p === String(maxprice) });
        }

        const opts = {
            isLastRow: current_bucket === String(maxprice),
            isLastCol: (parseInt(idx) + 1) % (maxcount + 1) === 0
        }

        return p === 0 || isNaN(p) ? NoData(opts) : Percent(p, opts)
    }
}