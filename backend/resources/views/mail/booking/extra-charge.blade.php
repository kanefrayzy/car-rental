<x-mail::message>
# A charge for your rental

Hi {{ Str::before($booking->name, ' ') }}, we charged **${{ number_format($charge->amount_usd, 2) }}** to your card{{ $booking->card_label ? ' ('.$booking->card_label.')' : '' }} for your rental of the {{ $booking->car->full_name }} ({{ $booking->pickup_date->format('M j') }} to {{ $booking->return_date->format('M j, Y') }}).

<x-mail::panel>
{{ $charge->reasonLabel() }}{{ $charge->note ? ': '.$charge->note : '' }}
</x-mail::panel>

This is one of the charges listed in our Rental Terms, which you agreed to when you booked. You also get a receipt from our payment processor, Stripe.

@include('mail.booking.questions')

Reference: {{ $booking->public_id }}
</x-mail::message>
