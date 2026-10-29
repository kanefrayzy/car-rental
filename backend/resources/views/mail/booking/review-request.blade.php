<x-mail::message>
# Thanks for driving with us

Hi {{ Str::before($booking->name, ' ') }}, thank you for renting the {{ $booking->car->full_name }}. We hope you enjoyed every mile.

If you have a minute, a short review on Google helps a small local business like ours more than anything.

<x-mail::button :url="$reviewUrl">
Leave a review
</x-mail::button>

We would love to have you back.

@include('mail.booking.questions')
</x-mail::message>
