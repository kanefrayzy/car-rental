<x-mail::message>
# Documents uploaded

**{{ $booking->name }}** uploaded their documents for the {{ $booking->car->full_name }}, {{ $booking->pickup_date->format('M j') }} to {{ $booking->return_date->format('M j, Y') }}.

@foreach ($booking->documentLinks() as $document)
- [{{ $document['label'] }}]({{ $document['url'] }})
@endforeach

These links work for {{ config('rental.document_link_days') }} days and only from this email. The documents are also on the booking in the admin panel.

<x-mail::button :url="route('filament.admin.resources.bookings.view', $booking)">
Open in the admin panel
</x-mail::button>

Reference: {{ $booking->public_id }}
</x-mail::message>
