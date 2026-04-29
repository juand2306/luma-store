from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwner(BasePermission):
    """Solo el dueño (owner) puede acceder."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "owner"


class IsOwnerOrAdmin(BasePermission):
    """Dueño o Administrador."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in ["owner", "admin"]
        )


class IsOwnerAdminOrSeller(BasePermission):
    """Dueño, Administrador o Vendedor."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in ["owner", "admin", "seller"]
        )


class CanViewOnly(BasePermission):
    """
    Visor: solo puede hacer GET.
    Cualquier otro rol autenticado puede hacer cualquier método.
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.role == "viewer":
            return request.method in SAFE_METHODS
        return True
