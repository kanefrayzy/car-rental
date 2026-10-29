<x-mail::message>
# Upload your documents

Hi {{ Str::before($booking->name, ' ') }}, to go ahead with your booking of the {{ $booking->car->full_name }} ({{ $booking->pickup_date->format('M j') }} to {{ $booking->return_date->format('M j, Y') }}) we need a photo of your driver’s license and your proof of full-coverage insurance.

<x-mail::button :url="$booking->pageUrl()">
Upload documents
</x-mail::button>

The link works for {{ config('rental.upload_link_days') }} days.

@include('mail.booking.questions')

Reference: {{ $booking->public_id }}

</x-mail::message>
