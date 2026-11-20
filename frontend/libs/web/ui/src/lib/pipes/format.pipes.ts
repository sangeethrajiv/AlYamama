import { Pipe, PipeTransform } from '@angular/core';
import { formatDate, formatDecimal, type Decimal } from '@erp/shared/utils';

/** `{{ '1234.5' | erpMoney }}` -> `1,234.50`. Accepts decimal strings only; arithmetic never goes through this pipe. */
@Pipe({ name: 'erpMoney' })
export class MoneyPipe implements PipeTransform {
  transform(value: Decimal | null | undefined, places = 2): string {
    return formatDecimal(value, places);
  }
}

/** `{{ value | erpQty }}` trims trailing zeros of a quantity: `10.0000` -> `10`, `2.5000` -> `2.5`. */
@Pipe({ name: 'erpQty' })
export class QuantityPipe implements PipeTransform {
  transform(value: Decimal | null | undefined): string {
    const s = formatDecimal(value, 4);
    return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  }
}

@Pipe({ name: 'erpDate' })
export class DatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatDate(value);
  }
}

/** `{{ amount | erpAmount }}` -> `1,234.50 SR`; other currencies show their code. */
@Pipe({ name: 'erpAmount' })
export class AmountPipe implements PipeTransform {
  transform(value: Decimal | null | undefined, currency = 'SAR'): string {
    return `${formatDecimal(value, 2)} ${currency === 'SAR' ? 'SR' : currency}`;
  }
}
