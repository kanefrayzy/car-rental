<x-mail::message>
# Your hold has been released

Hi {{ Str::before($booking->name, ' ') }}, we released the ${{ number_format($booking->deposit_usd) }} hold on your card{{ $booking->card_label ? ' ('.$booking->card_label.')' : '' }}. Nothing was charged. Your bank decides how fast the amount shows as available again, usually within a few business days.

Thanks for renting the {{ $booking->car->full_name }}.

@include('mail.booking.questions')

Reference: {{ $booking->public_id }}

</x-mail::message>
