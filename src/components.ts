import { clamp } from "./utils";

export const cell_flex = 'flex justify-center items-center';
const cell_border = (lastRow = false, lastCol = false) => `${lastRow ? '' : 'border-b-2'} ${lastCol ? '' : 'border-r-2'}`;
const cell_style = `${cell_flex} min-w-min border-solid p-1 min-h-[4rem]`;

const price_labels = {
    10: '€0.00 - 9.99',
    20: '€10.00 - 19.99',
    30: '€20.00 - 29.99',
    40: '€30.00 - 39.99',
    50: '> €49.99',
}

export const NoData = ({ isLastRow = false, isLastCol = false } = {}) => {
    const classes = `${cell_style} ${cell_border(isLastRow, isLastCol)}`.trim();
    return ['div', { class: classes }, 'No Sales']
}

export const Percent = (percent: number, { isLastRow = false, isLastCol = false } = {}) => {
    const classes = `${cell_style} ${cell_border(isLastRow, isLastCol)}`.trim();
    const value = isNaN(percent) ? 0 : percent < 1 ? percent.toFixed(2) : percent < 10 ? percent.toFixed(1) : percent.toFixed(0);
    const background = `rgba(0, 100, 0, ${(clamp(percent, 10, 90) / 100).toFixed(2)})`;

    return [
        'div',
        { class: classes, style: { 'background-color': background } },
        `${value}%`
    ]
}

export const PriceGroup = (bucket: string, { isLastRow = false } = {}) => {
    const classes = `${cell_style} ${cell_border(isLastRow)}`.trim();
    return  ['div', { class: classes }, price_labels[bucket]];
}