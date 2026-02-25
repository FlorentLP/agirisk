import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AssetService } from '../../../core/services/asset.service';
import { AssetCreate, CATEGORIES, STATUSES } from '../../../models/asset.model';

const TOO_CLOSE_MESSAGE = "L'actif est trop proche d'un actif existant de la même catégorie.";

@Component({
  selector: 'app-asset-form',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    SelectModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
  ],
  templateUrl: './asset-form.component.html',
  styleUrl: './asset-form.component.css',
})
export class AssetFormComponent {
  private fb = inject(FormBuilder);
  private assetService = inject(AssetService);
  private router = inject(Router);

  categoryOptions = CATEGORIES;
  statusOptions = STATUSES;
  errorMessage = '';
  submitting = false;

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    category: ['bouche_incendie' as const, Validators.required],
    status: ['operationnel' as const, Validators.required],
    latitude: [0, [Validators.required]],
    longitude: [0, [Validators.required]],
  });

  constructor() {
    const state = this.router.getCurrentNavigation()?.extras?.state as
      | { latitude?: number; longitude?: number }
      | undefined;
    if (state?.latitude != null && state?.longitude != null) {
      this.form.patchValue({ latitude: state.latitude, longitude: state.longitude });
    }
  }

  onSubmit(): void {
    this.errorMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    const value = this.form.getRawValue() as AssetCreate;
    this.assetService.create(value).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        this.submitting = false;
        const status = err?.status;
        const e = err?.error || {};
        const msg =
          (Array.isArray(e.position) ? e.position[0] : e.position) ||
          (Array.isArray(e.non_field_errors) ? e.non_field_errors[0] : e.non_field_errors) ||
          e.latitude ||
          e.longitude ||
          err?.message ||
          'Erreur lors de la création.';
        const message = typeof msg === 'string' ? msg : JSON.stringify(msg);
        if (status === 400 && (message.includes('trop proche') || message.includes('existe déjà') || message.includes('rayon'))) {
          this.router.navigate(['/'], { state: { createError: TOO_CLOSE_MESSAGE } });
          return;
        }
        this.errorMessage = message;
      },
      complete: () => {
        this.submitting = false;
      },
    });
  }
}
