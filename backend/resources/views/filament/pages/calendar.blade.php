<x-filament-panels::page>
    <div class="rental-calendar">
        <div class="rental-calendar__toolbar">
            <div class="rental-calendar__nav">
                <x-filament::icon-button icon="heroicon-m-chevron-left" wire:click="previousMonth" label="Previous month" color="gray" />
                <h2 class="rental-calendar__title">{{ $title }}</h2>
                <x-filament::icon-button icon="heroicon-m-chevron-right" wire:click="nextMonth" label="Next month" color="gray" />
                @unless ($isCurrentMonth)
                    <x-filament::button wire:click="thisMonth" color="gray" size="sm" outlined>Today</x-filament::button>
                @endunless
            </div>
            <ul class="rental-calendar__legend">
                <li><span class="rental-chip rental-chip--confirmed"></span>Confirmed</li>
                <li><span class="rental-chip rental-chip--returned"></span>Returned</li>
                <li><span class="rental-chip rental-chip--paid"></span>Deposit paid</li>
                <li><span class="rental-chip rental-chip--request"></span>New request</li>
                <li><span class="rental-chip rental-chip--expired"></span>Request, dates not held</li>
                <li><span class="rental-chip rental-chip--closed"></span>Closed</li>
            </ul>
        </div>

        <div class="rental-calendar__grid" role="grid" aria-label="{{ $title }}" wire:loading.class="rental-calendar__grid--loading">
            @foreach ($weekdays as $weekday)
                <div class="rental-calendar__weekday" role="columnheader">{{ $weekday }}</div>
            @endforeach

            @foreach ($weeks as $week)
                @foreach ($week as $day)
                    <div @class([
                        'rental-calendar__day',
                        'rental-calendar__day--outside' => ! $day['inMonth'],
                        'rental-calendar__day--today' => $day['isToday'],
                    ]) role="gridcell">
                        <span class="rental-calendar__date">{{ $day['date']->day }}</span>
                        @foreach ($day['slots'] as $slot)
                            @if ($slot)
                                <a href="{{ $slot['url'] }}"
                                   title="{{ $slot['label'] }}: {{ $slot['detail'] }}, {{ $slot['start']->format('M j') }} to {{ $slot['end']->format('M j') }}"
                                   @class([
                                       'rental-bar',
                                       'rental-bar--'.$slot['kind'],
                                       'rental-bar--start' => $slot['isStart'],
                                       'rental-bar--end' => $slot['isEnd'],
                                   ])>{{ $slot['showLabel'] ? $slot['label'] : "\u{00A0}" }}</a>
                            @else
                                <span class="rental-bar rental-bar--empty" aria-hidden="true">&nbsp;</span>
                            @endif
                        @endforeach
                    </div>
                @endforeach
            @endforeach
        </div>

        <x-filament::section heading="This month" compact>
            @if ($monthEvents === [])
                <p class="rental-calendar__empty">Nothing booked or closed in {{ $title }}.</p>
            @else
                <ul class="rental-calendar__list">
                    @foreach ($monthEvents as $event)
                        <li>
                            <a href="{{ $event['url'] }}">
                                <span class="rental-chip rental-chip--{{ $event['kind'] }}"></span>
                                <span class="rental-calendar__list-dates">
                                    {{ $event['start']->equalTo($event['end']) ? $event['start']->format('M j') : $event['start']->format('M j').' – '.$event['end']->format('M j') }}
                                </span>
                                <span class="rental-calendar__list-name">{{ $event['label'] }}</span>
                                <span class="rental-calendar__list-detail">{{ $event['detail'] }}</span>
                            </a>
                        </li>
                    @endforeach
                </ul>
            @endif
        </x-filament::section>
    </div>

    <style>
        .rental-calendar { display: flex; flex-direction: column; gap: 1.25rem; }
        .rental-calendar__toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem 1.5rem; }
        .rental-calendar__nav { display: flex; align-items: center; gap: .5rem; }
        .rental-calendar__title { min-width: 9.5rem; text-align: center; font-size: 1.125rem; font-weight: 600; }
        .rental-calendar__legend { display: flex; flex-wrap: wrap; gap: .375rem 1rem; font-size: .8125rem; color: var(--gray-600); }
        .rental-calendar__legend li { display: flex; align-items: center; gap: .375rem; }

        .rental-calendar__grid {
            display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));
            border: 1px solid var(--gray-200); border-radius: .75rem; overflow: hidden; background: var(--gray-200); gap: 1px;
            transition: opacity .15s;
        }
        .rental-calendar__grid--loading { opacity: .6; }
        .rental-calendar__weekday { background: var(--gray-50); padding: .5rem; font-size: .75rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase; letter-spacing: .04em; }
        .rental-calendar__day { background: #fff; min-height: 6.5rem; padding: .375rem 0 .5rem; display: flex; flex-direction: column; gap: 2px; }
        .rental-calendar__day--outside { background: var(--gray-50); }
        .rental-calendar__day--outside .rental-calendar__date { color: var(--gray-400); }
        .rental-calendar__date { padding: 0 .5rem; font-size: .8125rem; font-weight: 500; color: var(--gray-700); line-height: 1.5rem; }
        .rental-calendar__day--today .rental-calendar__date {
            align-self: flex-start; margin-left: .25rem; padding: 0 .4rem; border-radius: 999px;
            background: var(--primary-600); color: #fff;
        }

        .rental-bar {
            display: block; height: 1.375rem; line-height: 1.375rem; padding: 0 .375rem;
            font-size: .75rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            color: #fff; text-decoration: none;
        }
        .rental-bar--start { margin-left: .25rem; border-top-left-radius: .375rem; border-bottom-left-radius: .375rem; }
        .rental-bar--end { margin-right: .25rem; border-top-right-radius: .375rem; border-bottom-right-radius: .375rem; }
        .rental-bar--empty { visibility: hidden; }
        .rental-bar:hover { filter: brightness(.92); }

        .rental-bar--confirmed, .rental-chip--confirmed { background: var(--success-600); }
        .rental-bar--paid, .rental-chip--paid { background: var(--info-600); }
        .rental-bar--returned, .rental-chip--returned { background: var(--violet-600); }
        .rental-bar--request, .rental-chip--request { background: var(--warning-500); color: var(--gray-950); }
        .rental-bar--expired, .rental-chip--expired {
            background: repeating-linear-gradient(135deg, var(--warning-100), var(--warning-100) 5px, var(--warning-200) 5px, var(--warning-200) 10px);
            color: var(--gray-800);
        }
        .rental-bar--closed, .rental-chip--closed { background: var(--gray-500); }
        .rental-chip { display: inline-block; flex: none; width: .75rem; height: .75rem; border-radius: .25rem; }

        .rental-calendar__empty { font-size: .875rem; color: var(--gray-500); }
        .rental-calendar__list { display: flex; flex-direction: column; }
        .rental-calendar__list a {
            display: grid; grid-template-columns: auto 7.5rem minmax(0, 1fr) auto; align-items: center; gap: .75rem;
            padding: .5rem .25rem; border-radius: .5rem; font-size: .875rem; text-decoration: none; color: inherit;
        }
        .rental-calendar__list a:hover { background: var(--gray-50); }
        .rental-calendar__list-dates { font-variant-numeric: tabular-nums; color: var(--gray-600); }
        .rental-calendar__list-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rental-calendar__list-detail { font-size: .8125rem; color: var(--gray-500); }

        @media (max-width: 640px) {
            .rental-calendar__day { min-height: 4.5rem; }
            .rental-bar { font-size: 0; height: .5rem; }
            .rental-calendar__list a { grid-template-columns: auto 6.5rem minmax(0, 1fr); }
            .rental-calendar__list-detail { grid-column: 3; margin-top: -.5rem; }
        }

        .dark .rental-calendar__grid { border-color: var(--gray-700); background: var(--gray-700); }
        .dark .rental-calendar__weekday, .dark .rental-calendar__day--outside { background: var(--gray-900); }
        .dark .rental-calendar__day { background: var(--gray-950); }
        .dark .rental-calendar__day--outside { background: var(--gray-900); }
        .dark .rental-calendar__date { color: var(--gray-300); }
        .dark .rental-calendar__legend, .dark .rental-calendar__list-dates { color: var(--gray-400); }
        .dark .rental-calendar__list a:hover { background: var(--gray-800); }
    </style>
</x-filament-panels::page>
