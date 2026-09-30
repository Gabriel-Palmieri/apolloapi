import { occupancy } from './availability.js';
const day = (n: number) => new Date(Date.UTC(2026, 9, n));
const row = (id: string, a: number, b: number, picked = false) => ({
  id,
  startDate: day(a),
  endDate: day(b),
  pickedUpAt: picked ? day(a) : null,
});
describe('Disponibilidade por período', () => {
  it('reutiliza unidade em reservas não simultâneas', () =>
    expect(
      occupancy([row('a', 1, 3), row('b', 5, 7)], day(1), day(10), day(1)).peak,
    ).toBe(1));
  it('considera retirada e devolução inclusivas', () =>
    expect(
      occupancy([row('a', 1, 3), row('b', 3, 7)], day(1), day(10), day(1)).peak,
    ).toBe(2));
  it('ignora reservas fora do período', () =>
    expect(occupancy([row('a', 1, 3)], day(5), day(7), day(1)).peak).toBe(0));
  it('atraso bloqueia indefinidamente até devolução', () =>
    expect(occupancy([row('a', 1, 3, true)], day(8), day(10), day(5))).toEqual({
      peak: 1,
      overdueIds: ['a'],
    }));
  it('reserva vencida sem retirada não vira atraso físico', () =>
    expect(occupancy([row('a', 1, 3)], day(8), day(10), day(5)).peak).toBe(0));
  it('venda precisa preservar o pico de todas as reservas futuras', () =>
    expect(
      occupancy([row('a', 10, 20), row('b', 15, 22)], day(1), null, day(1))
        .peak,
    ).toBe(2));
});
