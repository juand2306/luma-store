"""
manage.py merge_duplicate_customers

Detecta clientes duplicados (mismo teléfono) y los fusiona en un único registro.

Uso:
    python manage.py merge_duplicate_customers            # aplica cambios
    python manage.py merge_duplicate_customers --dry-run # solo muestra qué haría

Estrategia:
    1. Normaliza todos los teléfonos (quita espacios/guiones/paréntesis) para
       que "300 123 4567" y "3001234567" se reconozcan como el mismo número.
    2. Agrupa clientes por teléfono normalizado.
    3. Para cada grupo con 2+ registros, conserva el más antiguo (menor id)
       como registro canónico y elimina los duplicados después de reasignar:
         - Ventas  (Sale.customer)
         - Pedidos (Order.customer)
         - Puntos  (suma acumulada)
"""
import re

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count

from apps.customers.models import Customer


class Command(BaseCommand):
    help = (
        "Fusiona clientes duplicados por teléfono. "
        "Conserva el registro más antiguo y reasigna ventas y pedidos."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra qué se haría sin aplicar ningún cambio.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("⚠  DRY RUN — no se aplicarán cambios.\n"))

        # ── Paso 1: normalizar teléfonos existentes ───────────────────────────
        normalized_count = 0
        for customer in Customer.objects.exclude(phone="").iterator():
            normalized = re.sub(r"[^\d+]", "", customer.phone)
            if normalized != customer.phone:
                normalized_count += 1
                if not dry_run:
                    Customer.objects.filter(pk=customer.pk).update(phone=normalized)

        self.stdout.write(f"Teléfonos normalizados: {normalized_count}")

        # ── Paso 2: encontrar grupos duplicados ───────────────────────────────
        duplicate_phones = list(
            Customer.objects
            .exclude(phone="")
            .values("phone")
            .annotate(count=Count("id"))
            .filter(count__gt=1)
            .values_list("phone", flat=True)
        )

        if not duplicate_phones:
            self.stdout.write(self.style.SUCCESS("No se encontraron duplicados. ¡Todo limpio!"))
            return

        self.stdout.write(
            f"Grupos duplicados encontrados: {len(duplicate_phones)}\n"
        )

        merged_groups = 0
        deleted_total = 0

        # ── Paso 3: fusionar cada grupo ───────────────────────────────────────
        for phone in duplicate_phones:
            customers = list(
                Customer.objects.filter(phone=phone).order_by("id")
            )
            canonical  = customers[0]   # el más antiguo es el canónico
            duplicates = customers[1:]

            self.stdout.write(
                f"\n  Teléfono {phone}:\n"
                f"    Canónico   → ID {canonical.id}  ({canonical.name})\n"
                f"    Duplicados → {[f'ID {d.id} ({d.name})' for d in duplicates]}"
            )

            if dry_run:
                continue

            with transaction.atomic():
                accumulated_points = canonical.points

                for dup in duplicates:
                    # Reasignar ventas al canónico
                    dup.sales.all().update(customer=canonical)

                    # Reasignar pedidos al canónico (FK agregado en Sprint 3)
                    dup.orders.all().update(customer=canonical)

                    # Acumular puntos de fidelización
                    accumulated_points += dup.points

                    dup.delete()

                canonical.points = accumulated_points
                canonical.save(update_fields=["points"])

            merged_groups += 1
            deleted_total += len(duplicates)

        # ── Resumen ───────────────────────────────────────────────────────────
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"\nDRY RUN completado: se fusionarían {len(duplicate_phones)} grupos."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\nFusión completada: {merged_groups} grupos fusionados, "
                    f"{deleted_total} duplicados eliminados."
                )
            )
