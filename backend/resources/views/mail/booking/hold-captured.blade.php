<x-mail::message>
# Part of your hold was used

Hi {{ Str::before($booking->name, ' ') }}, thanks for renting the {{ $booking->car->full_name }}. We used **${{ number_format($booking->hold_captured_usd, 2) }}** from the ${{ number_format($booking->deposit_usd) }} hold on your card{{ $booking->card_label ? ' ('.$booking->card_label.')' : '' }} for:

<x-mail::panel>
{{ $booking->hold_capture_reason }}
</x-mail::panel>

These charges are described in our Rental Terms, which you agreed to when you booked.

The remaining **${{ number_format($booking->deposit_usd - $booking->hold_captured_usd, 2) }}** was released. Your bank decides how fast it shows as available again, usually within a few business days.

@include('mail.booking.questions')

Reference: {{ $booking->public_id }}

</x-mail::message>
