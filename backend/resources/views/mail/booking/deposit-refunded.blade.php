<x-mail::message>
# Your deposit is on its way back

Hi {{ Str::before($booking->name, ' ') }}, we refunded **${{ number_format($booking->deposit_refunded_usd, 2) }}** of your ${{ number_format($booking->deposit_usd) }} deposit to the card you paid with. Depending on your bank it can take 5 to 10 business days to show up.

@if ($booking->deposit_refund_note)
<x-mail::panel>
{{ $booking->deposit_refund_note }}
</x-mail::panel>
@endif

Thanks for renting the {{ $booking->car->full_name }}.

@include('mail.booking.questions')

Reference: {{ $booking->public_id }}

</x-mail::message>
