import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyStateComponent } from '@erp/web/ui';

@Component({
  selector: 'erp-error-page',
  imports: [RouterLink, TranslocoPipe, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="erp-card mx-auto mt-10 max-w-lg">
      <erp-empty-state [icon]="kind() === 'forbidden' ? 'lock' : 'search'" [title]="(kind() === 'forbidden' ? 'common.forbiddenTitle' : 'common.notFoundTitle') | transloco"
        [text]="(kind() === 'forbidden' ? 'common.forbiddenText' : 'common.notFoundText') | transloco">
        <a routerLink="/dashboard" class="erp-btn-primary mt-3">{{ 'common.goDashboard' | transloco }}</a>
      </erp-empty-state>
    </div>`,
})
export class ErrorPageComponent {
  readonly kind = input<'forbidden' | 'notFound'>('notFound');
}

@Component({ selector: 'erp-forbidden-page', imports: [ErrorPageComponent], template: `<erp-error-page kind="forbidden" />` })
export class ForbiddenPage {}

@Component({ selector: 'erp-not-found-page', imports: [ErrorPageComponent], template: `<erp-error-page kind="notFound" />` })
export class NotFoundPage {}
