from django.http import JsonResponse

def placeholder(request):
    return JsonResponse({'message': 'API placeholder'})
