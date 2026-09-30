import { BadRequestException } from '@nestjs/common';

export function today() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return new Date(
    value('year') +
      '-' +
      value('month') +
      '-' +
      value('day') +
      'T00:00:00.000Z',
  );
}

export function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('Use datas YYYY-MM-DD.');
  const date = new Date(value + 'T00:00:00.000Z');
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Data inválida.');
  return date;
}

export function operationDates(
  type: 'SALE' | 'RENTAL',
  start?: string | null,
  end?: string | null,
) {
  if (type === 'SALE') {
    if (start || end)
      throw new BadRequestException('Venda não possui período de locação.');
    return { startDate: null, endDate: null };
  }
  if (!start || !end)
    throw new BadRequestException('Informe retirada e devolução.');
  const startDate = parseDay(start),
    endDate = parseDay(end);
  if (startDate < today() || endDate < startDate)
    throw new BadRequestException(
      'O período deve iniciar hoje ou depois, com devolução igual ou posterior à retirada.',
    );
  return { startDate, endDate };
}
