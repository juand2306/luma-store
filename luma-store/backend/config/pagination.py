from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    """
    Paginación estándar para todas las listas del sistema.
    El cliente puede controlar el tamaño con ?page_size=N (máximo 200).
    Respuesta: { count, next, previous, results: [...] }
    """
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200

    def get_paginated_response(self, data):
        return Response({
            "count":    self.page.paginator.count,
            "next":     self.get_next_link(),
            "previous": self.get_previous_link(),
            "results":  data,
        })

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "properties": {
                "count":    {"type": "integer"},
                "next":     {"type": "string", "nullable": True},
                "previous": {"type": "string", "nullable": True},
                "results":  schema,
            },
        }
