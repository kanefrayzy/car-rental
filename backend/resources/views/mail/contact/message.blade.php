<x-mail::message>
# New question from the website

<x-mail::table>
| | |
|:--|:--|
| Name | {{ $name }} |
| Email | {{ $email }} |
| Phone | {{ $phone }} |
| Occasion | {{ $occasion }} |
| Preferred dates | {{ $preferredDates ?: 'Not given' }} |
</x-mail::table>

<x-mail::panel>
{!! nl2br(e($body)) !!}
</x-mail::panel>

Reply to this email to answer {{ Str::before($name, ' ') }}.
</x-mail::message>
