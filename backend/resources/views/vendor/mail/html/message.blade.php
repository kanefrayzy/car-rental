{{-- Laravel's message layout with the business details in the footer. --}}
<x-mail::layout>
<x-slot:header>
<x-mail::header :url="rtrim(config('rental.frontend_url'), '/')">
{{ config('app.name') }}
</x-mail::header>
</x-slot:header>

{!! $slot !!}

@isset($subcopy)
<x-slot:subcopy>
<x-mail::subcopy>
{!! $subcopy !!}
</x-mail::subcopy>
</x-slot:subcopy>
@endisset

<x-slot:footer>
<x-mail::footer>
**{{ config('app.name') }}** · Exotic car rental · {{ config('rental.business.city') }}<br>
[{{ config('rental.business.phone') }}](tel:{{ preg_replace('/[^\d+]/', '', config('rental.business.phone_e164')) }}) · [{{ parse_url(config('rental.frontend_url'), PHP_URL_HOST) }}]({{ config('rental.frontend_url') }})
</x-mail::footer>
</x-slot:footer>
</x-mail::layout>
