import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ToolbarModule } from 'primeng/toolbar';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet, ToolbarModule, ToastModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
